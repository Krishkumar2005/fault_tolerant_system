import { useEffect, useState } from 'react';
import { fetchAggregations } from '../api';

function StatCard({ label, value, accent }) {
  return (
    <div className={`rounded-lg border p-4 ${accent}`}>
      <div className="text-xs text-[--text-secondary] uppercase tracking-widest mb-1">{label}</div>
      <div className="mono text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function Aggregations({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAggregations()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[--border] bg-[--surface] p-6">
        <h2 className="text-sm font-semibold text-[--text-secondary] uppercase tracking-widest mb-4">Aggregations</h2>
        <div className="text-[--text-muted] text-sm text-center py-8">Loading...</div>
      </div>
    );
  }

  const totals = data?.totals || { totalAmount: 0, totalCount: 0 };

  return (
    <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-5">
      <h2 className="text-sm font-semibold text-[--text-secondary] uppercase tracking-widest">
        Aggregations
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Amount"
          value={totals.totalAmount?.toLocaleString() ?? '0'}
          accent="border-[--accent] border-opacity-30 bg-[--accent-dim] text-[--accent]"
        />
        <StatCard
          label="Event Count"
          value={totals.totalCount ?? '0'}
          accent="border-[--info] border-opacity-30 bg-[--info-dim] text-[--info]"
        />
      </div>

      {data?.byMetric?.length > 0 && (
        <div>
          <div className="text-xs text-[--text-muted] uppercase tracking-widest mb-2">By Metric</div>
          <div className="space-y-1.5">
            {data.byMetric.map((m) => (
              <div key={m._id} className="flex items-center justify-between text-sm rounded bg-[--bg] px-3 py-2 border border-[--border]">
                <span className="text-[--text-primary] mono">{m._id || 'unknown'}</span>
                <div className="flex gap-4 text-[--text-secondary] text-xs mono">
                  <span>Σ {m.totalAmount?.toLocaleString()}</span>
                  <span className="text-[--text-muted]">×{m.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.byClient?.length > 0 && (
        <div>
          <div className="text-xs text-[--text-muted] uppercase tracking-widest mb-2">By Client</div>
          <div className="space-y-1.5">
            {data.byClient.map((c) => (
              <div key={c._id} className="flex items-center justify-between text-sm rounded bg-[--bg] px-3 py-2 border border-[--border]">
                <span className="text-[--accent] mono">{c._id}</span>
                <div className="flex gap-4 text-[--text-secondary] text-xs mono">
                  <span>Σ {c.totalAmount?.toLocaleString()}</span>
                  <span className="text-[--text-muted]">×{c.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data?.byMetric?.length && !data?.byClient?.length && (
        <div className="text-[--text-muted] text-sm text-center py-4">No data yet. Submit some events!</div>
      )}
    </div>
  );
}
