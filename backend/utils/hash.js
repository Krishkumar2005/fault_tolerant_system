const crypto = require("crypto");

/**
 * generateEventHash(normalizedData) -> string
 *
 * Creates a deterministic SHA-256 hash from the canonical fields of an event.
 * This hash is used as the deduplication key in processed_events.
 *
 * WHY these four fields:
 * - client_id: events from different clients are never duplicates
 * - metric: distinguishes event types from same client
 * - amount: same client+metric at same time but different amount = different event
 * - timestamp: same client+metric+amount but different time = different event
 *
 * We use the ISO timestamp string (not the Date object) to ensure consistent
 * serialization regardless of JS runtime timezone behavior.
 */
function generateEventHash({ client_id, metric, amount, timestamp }) {
  const raw = `${client_id}|${metric}|${amount}|${timestamp}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

module.exports = { generateEventHash };
