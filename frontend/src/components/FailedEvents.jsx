import { useEffect, useState } from 'react';
import { fetchFailedEvents } from '../api';

export default function FailedEvents({ refreshKey }) {
  const [data, setData] = useState({ count: 0, events: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchFailedEvents()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[--text-secondary] uppercase tracking-widest">
          Failed / Rejected Events
        </h2>
        <span className="mono text-xs px-2 py-1 rounded-full bg-[--danger-dim] text-[--danger]">
          {data.count} total
        </span>
      </div>

      {loading ? (
        <div className="text-[--text-muted] text-sm text-center py-8">Loading...</div>
      ) : data.events.length === 0 ? (
        <div className="text-[--text-muted] text-sm text-center py-8">No failed events. System is clean.</div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {data.events.map((ev) => (
            <div
              key={ev._id}
              className="rounded-lg border border-[--danger] border-opacity-30 bg-[--danger-dim] px-4 py-3 text-xs fade-up"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[--danger] font-semibold mono">
                  {ev.rawPayload?.source || 'unknown source'}
                </span>
                <span className="text-[--text-muted]">
                  {new Date(ev.failedAt).toLocaleString()}
                </span>
              </div>
              <div className="text-[--danger] opacity-80">{ev.reason}</div>
              <div className="mt-2 text-[--text-muted] mono text-xs truncate">
                {JSON.stringify(ev.rawPayload?.payload || ev.rawPayload)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
