const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

/**
 * FIELD MAPPINGS — configurable, not hardcoded per client.
 *
 * Instead of scattering `if (source === 'client_A') ...` checks everywhere,
 * we define candidate field names per canonical key. The normalizer tries
 * each alias in order and takes the first non-null value it finds.
 *
 * Adding support for a new client field variant = adding one entry here.
 */
const FIELD_MAPPINGS = {
  metric: ["metric", "event_type", "type", "event", "name"],
  amount: ["amount", "price", "value", "total", "cost", "sum"],
  timestamp: ["timestamp", "time", "date", "created_at", "event_time", "ts"],
};

/**
 * Date formats we attempt to parse in order.
 * dayjs will try each format until one succeeds.
 */
const DATE_FORMATS = [
  "YYYY-MM-DDTHH:mm:ssZ",
  "YYYY-MM-DDTHH:mm:ss.SSSZ",
  "YYYY-MM-DD",
  "YYYY/MM/DD",
  "DD-MM-YYYY",
  "MM/DD/YYYY",
  "MM-DD-YYYY",
  "DD/MM/YYYY",
];

/**
 * Resolve a canonical field by trying each alias against the payload.
 * Returns the first value found, or null if none match.
 */
function resolveField(payload, aliases) {
  for (const alias of aliases) {
    if (payload[alias] !== undefined && payload[alias] !== null && payload[alias] !== "") {
      return payload[alias];
    }
  }
  return null;
}

/**
 * Safely parse a date string into an ISO 8601 UTC string.
 * Returns null if the date cannot be parsed — the caller decides what to do.
 */
function parseDate(raw) {
  if (!raw) return null;

  // Already a Date object or numeric timestamp
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "number") {
    const d = dayjs(raw);
    return d.isValid() ? d.toISOString() : null;
  }

  const str = String(raw).trim();

  // Try strict parsing with known formats first
  for (const fmt of DATE_FORMATS) {
    const parsed = dayjs(str, fmt, true); // strict=true
    if (parsed.isValid()) return parsed.toISOString();
  }

  // Fall back to dayjs heuristic parsing
  const fallback = dayjs(str);
  return fallback.isValid() ? fallback.toISOString() : null;
}

/**
 * Safely parse a number. Returns null for truly unparseable values.
 * Handles strings like "1,200.50" by stripping commas.
 */
function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const cleaned = String(raw).replace(/,/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * normalize(rawPayload) -> { ok: true, data } | { ok: false, reason }
 *
 * Converts a raw client payload into the canonical internal format.
 * Failures are returned as structured errors, never thrown — the caller
 * is responsible for routing to failed_events if ok === false.
 */
function normalize(rawPayload) {
  // Tolerate both flat and nested payloads:
  // { source, payload: { ... } }  OR  { source, metric, amount, ... }
  const source = rawPayload.source || rawPayload.client_id || rawPayload.client || null;
  const inner = rawPayload.payload || rawPayload;

  if (!source) {
    return { ok: false, reason: "Missing required field: source / client_id" };
  }

  // Resolve canonical fields using configurable aliases
  const rawMetric = resolveField(inner, FIELD_MAPPINGS.metric);
  const rawAmount = resolveField(inner, FIELD_MAPPINGS.amount);
  const rawTimestamp = resolveField(inner, FIELD_MAPPINGS.timestamp);

  // Parse amount
  const amount = parseAmount(rawAmount);
  if (amount === null) {
    return { ok: false, reason: `Invalid or missing amount: received "${rawAmount}"` };
  }

  // Parse timestamp
  const timestamp = parseDate(rawTimestamp);
  if (!timestamp) {
    return { ok: false, reason: `Unparseable timestamp: received "${rawTimestamp}"` };
  }

  return {
    ok: true,
    data: {
      client_id: String(source).trim(),
      metric: rawMetric ? String(rawMetric).trim() : "unknown",
      amount,
      timestamp,
      // Extra fields from the payload are intentionally dropped here.
      // They remain accessible in the raw_events collection if needed.
    },
  };
}

module.exports = { normalize };
