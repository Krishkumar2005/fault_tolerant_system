const mongoose = require("mongoose");

/**
 * RawEvent stores every incoming payload exactly as received.
 * This ensures we never lose original client data, even if normalization fails.
 * The status lifecycle tracks where in the pipeline the event is.
 */
const rawEventSchema = new mongoose.Schema(
  {
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // RECEIVED -> PROCESSED | FAILED
    status: {
      type: String,
      enum: ["RECEIVED", "PROCESSED", "FAILED"],
      default: "RECEIVED",
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RawEvent", rawEventSchema);
