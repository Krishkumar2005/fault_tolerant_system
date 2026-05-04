const mongoose = require("mongoose");

/**
 * FailedEvent captures events that could not be normalized or processed.
 * Storing failures separately (rather than deleting them) allows:
 * - manual inspection and replay
 * - debugging schema drift from clients
 * - metrics on failure rates per client
 */
const failedEventSchema = new mongoose.Schema(
  {
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    failedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FailedEvent", failedEventSchema);
