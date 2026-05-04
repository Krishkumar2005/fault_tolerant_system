import { useEffect, useState } from 'react';
import { fetchProcessedEvents } from '../api';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function ProcessedEvents({ refreshKey }) {
  const [data, setData] = useState({ count: 0, events: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchProcessedEvents({ limit: 20 })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[--text-secondary] uppercase tracking-widest">
          Processed Events
        </h2>
        <span className="mono text-xs px-2 py-1 rounded-full bg-[--accent-dim] text-[--accent]">
          {data.count} total
        </span>
      </div>

      {loading ? (
        <div className="text-[--text-muted] text-sm text-center py-8">Loading...</div>
      ) : data.events.length === 0 ? (
        <div className="text-[--text-muted] text-sm text-center py-8">No processed events yet.</div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {data.events.map((ev) => (
            <div
              key={ev._id}
              className="rounded-lg border border-[--border] bg-[--bg] px-4 py-3 text-xs mono fade-up"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[--accent] font-semibold">{ev.client_id}</span>
                <span className="text-[--text-muted]">{formatDate(ev.timestamp)}</span>
              </div>
              <div className="flex gap-4 text-[--text-secondary]">
                <span>metric: <span className="text-[--text-primary]">{ev.metric}</span></span>
                <span>amount: <span className="text-[--text-primary]">{ev.amount}</span></span>
              </div>
              <div className="mt-1 text-[--text-muted] truncate" title={ev.eventHash}>
                hash: {ev.eventHash?.slice(0, 16)}...
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
