import { useState, useCallback } from 'react';
import EventSubmitter from './components/EventSubmitter';
import ProcessedEvents from './components/ProcessedEvents';
import FailedEvents from './components/FailedEvents';
import Aggregations from './components/Aggregations';

export default function App() {
  // incrementing this triggers a refresh in all dashboard panels
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="border-b border-[--border] bg-[--surface] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[--accent] pulse-dot" />
            <h1 className="mono font-semibold text-[--text-primary] tracking-tight">
              DataStream
            </h1>
            <span className="text-xs text-[--text-muted] border border-[--border-bright] rounded px-2 py-0.5">
              Fault-Tolerant Ingestion
            </span>
          </div>
          <button
            onClick={refresh}
            className="text-xs text-[--text-secondary] hover:text-[--accent] transition-colors mono"
          >
            ↻ refresh
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <EventSubmitter onSuccess={refresh} />
          <Aggregations refreshKey={refreshKey} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <ProcessedEvents refreshKey={refreshKey} />
          <FailedEvents refreshKey={refreshKey} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[--border] px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto text-xs text-[--text-muted] mono text-center">
          SHA-256 deduplication · append-only raw log · atomic status transitions
        </div>
      </footer>
    </div>
  );
}
