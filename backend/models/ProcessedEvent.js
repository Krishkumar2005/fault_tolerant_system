const mongoose = require("mongoose");

/**
 * ProcessedEvent stores normalized canonical data.
 * The eventHash field has a UNIQUE index — this is the primary mechanism
 * for idempotency. If a duplicate event arrives (same client, metric,
 * amount, timestamp), the hash will match and Mongo will reject the insert
 * with a duplicate key error, preventing double-counting.
 */
const processedEventSchema = new mongoose.Schema(
  {
    // SHA-256 hash of (client_id + metric + amount + timestamp)
    // Unique constraint enforces deduplication at the DB level
    eventHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    client_id: { type: String, required: true },
    metric: { type: String, default: "unknown" },
    amount: { type: Number, default: 0 },
    timestamp: { type: Date, required: true },
    // Keep a reference to the raw event for auditability
    rawEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RawEvent",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProcessedEvent", processedEventSchema);
