const ProcessedEvent = require("../models/ProcessedEvent");

/**
 * GET /aggregations
 *
 * Returns aggregated metrics using MongoDB aggregation pipeline.
 * Separated from ingestion intentionally — aggregation reads from
 * processed_events only, so it is never affected by failed/raw events.
 *
 * Query params:
 * - client: filter by client_id
 * - from: ISO date string (inclusive lower bound on timestamp)
 * - to: ISO date string (inclusive upper bound on timestamp)
 *
 * Response shape:
 * {
 *   totals: { totalAmount, totalCount },
 *   byMetric: [{ _id: "purchase", totalAmount, count }],
 *   byClient: [{ _id: "client_A", totalAmount, count }]
 * }
 */
async function getAggregations(req, res) {
  try {
    const { client, from, to } = req.query;

    // Build the match stage dynamically based on provided filters
    const match = {};
    if (client) match.client_id = client;
    if (from || to) {
      match.timestamp = {};
      if (from) match.timestamp.$gte = new Date(from);
      if (to) match.timestamp.$lte = new Date(to);
    }

    // Run three aggregation pipelines in parallel for efficiency
    const [totals, byMetric, byClient] = await Promise.all([
      // Overall totals
      ProcessedEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            totalCount: { $count: {} },
          },
        },
      ]),

      // Grouped by metric type
      ProcessedEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$metric",
            totalAmount: { $sum: "$amount" },
            count: { $count: {} },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),

      // Grouped by client
      ProcessedEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$client_id",
            totalAmount: { $sum: "$amount" },
            count: { $count: {} },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
    ]);

    res.json({
      totals: totals[0] || { totalAmount: 0, totalCount: 0 },
      byMetric,
      byClient,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAggregations };
