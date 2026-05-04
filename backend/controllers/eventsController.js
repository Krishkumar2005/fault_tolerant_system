const RawEvent = require("../models/RawEvent");
const ProcessedEvent = require("../models/ProcessedEvent");
const FailedEvent = require("../models/FailedEvent");
const { normalize } = require("../services/normalizer");
const { generateEventHash } = require("../utils/hash");

/**
 * POST /events
 *
 * Ingestion pipeline:
 * 1. Save raw event (status: RECEIVED) — never lose data
 * 2. Normalize — convert to canonical format or route to failed_events
 * 3. Generate deterministic hash — basis for idempotency
 * 4. Insert processed event — unique index on hash prevents duplicates
 * 5. Update raw event status to PROCESSED or FAILED
 *
 * Retry safety:
 * - Step 1 may re-insert a raw event on retry (raw events are not deduplicated
 *   by design — they are an append-only audit log)
 * - Steps 3-4 are idempotent: duplicate hash = Mongo throws 11000 error,
 *   which we catch and return 200 "already processed"
 *
 * Simulate failure:
 * - If header X-Simulate-Failure: true is set, we intentionally fail at the
 *   DB write step to demonstrate retry safety. On retry, the hash check
 *   prevents double processing.
 */
async function ingestEvent(req, res) {
  const simulateFailure = req.headers["x-simulate-failure"] === "true";
  const rawPayload = req.body;

  // ── Step 1: Persist raw event immediately ────────────────────────────────
  // We do this before ANY validation so we never lose what the client sent.
  let rawEvent;
  try {
    rawEvent = await RawEvent.create({ rawPayload, status: "RECEIVED" });
  } catch (err) {
    // If we can't even save the raw event, something is seriously wrong
    return res.status(500).json({ error: "Failed to persist raw event", detail: err.message });
  }

  // ── Step 2: Normalize ────────────────────────────────────────────────────
  const result = normalize(rawPayload);

  if (!result.ok) {
    // Normalization failed — store in failed_events and mark raw as FAILED
    await FailedEvent.create({ rawPayload, reason: result.reason });
    await RawEvent.findByIdAndUpdate(rawEvent._id, { status: "FAILED" });
    return res.status(422).json({ error: "Normalization failed", reason: result.reason });
  }

  const normalized = result.data;

  // ── Step 3: Generate idempotency hash ────────────────────────────────────
  const eventHash = generateEventHash(normalized);

  // ── Simulate failure BEFORE DB write ────────────────────────────────────
  // This simulates the exact scenario: validated, about to write, then crash.
  // On retry: raw event saved again, normalization succeeds again, hash lookup
  // finds the existing record (if first attempt partially succeeded) OR the
  // unique index blocks the duplicate insert.
  if (simulateFailure) {
    await RawEvent.findByIdAndUpdate(rawEvent._id, { status: "FAILED" });
    await FailedEvent.create({ rawPayload, reason: "Simulated DB failure" });
    return res.status(500).json({
      error: "Simulated failure: DB write intentionally aborted",
      hint: "Retry this request — the hash will prevent double processing",
    });
  }

  // ── Step 4: Insert processed event ──────────────────────────────────────
  try {
    await ProcessedEvent.create({
      eventHash,
      ...normalized,
      rawEventId: rawEvent._id,
    });
  } catch (err) {
    // Mongo error code 11000 = duplicate key = event already processed
    if (err.code === 11000) {
      // Still mark raw event as PROCESSED for consistency
      await RawEvent.findByIdAndUpdate(rawEvent._id, { status: "PROCESSED" });
      return res.status(200).json({
        status: "already_processed",
        message: "Duplicate event detected via hash — skipped safely",
        eventHash,
      });
    }

    // Unexpected DB error — mark raw as FAILED so we know it needs attention
    await RawEvent.findByIdAndUpdate(rawEvent._id, { status: "FAILED" });
    await FailedEvent.create({ rawPayload, reason: `DB write failed: ${err.message}` });
    return res.status(500).json({ error: "Failed to save processed event", detail: err.message });
  }

  // ── Step 5: Update raw event status ─────────────────────────────────────
  await RawEvent.findByIdAndUpdate(rawEvent._id, { status: "PROCESSED" });

  return res.status(201).json({
    status: "processed",
    eventHash,
    normalized,
  });
}

/**
 * GET /events
 * Returns processed events with optional filters.
 */
async function getProcessedEvents(req, res) {
  try {
    const { client, from, to, limit = 50 } = req.query;
    const filter = {};

    if (client) filter.client_id = client;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const events = await ProcessedEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ count: events.length, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /failed-events
 * Returns events that failed normalization or DB write.
 */
async function getFailedEvents(req, res) {
  try {
    const events = await FailedEvent.find().sort({ failedAt: -1 }).limit(50).lean();
    res.json({ count: events.length, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { ingestEvent, getProcessedEvents, getFailedEvents };
