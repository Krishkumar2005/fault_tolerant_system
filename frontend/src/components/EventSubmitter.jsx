import { useState } from 'react';
import { submitEvent } from '../api';

const SAMPLE_EVENTS = [
  {
    label: 'client_A (standard)',
    value: JSON.stringify({ source: 'client_A', payload: { metric: 'purchase', amount: '1200', timestamp: '2024/01/01' } }, null, 2),
  },
  {
    label: 'client_B (different fields)',
    value: JSON.stringify({ source: 'client_B', payload: { event_type: 'refund', price: 350, time: '01-15-2024' } }, null, 2),
  },
  {
    label: 'client_C (malformed amount)',
    value: JSON.stringify({ source: 'client_C', payload: { metric: 'sale', amount: 'not-a-number', timestamp: '2024-03-01' } }, null, 2),
  },
  {
    label: 'Missing timestamp',
    value: JSON.stringify({ source: 'client_D', payload: { metric: 'click', amount: 0 } }, null, 2),
  },
];

export default function EventSubmitter({ onSuccess }) {
  const [input, setInput] = useState(SAMPLE_EVENTS[0].value);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error'|'duplicate'|'simulated', message, detail }
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setStatus(null);
    setLoading(true);
    let parsed;
    try {
      parsed = JSON.parse(input);
    } catch {
      setStatus({ type: 'error', message: 'Invalid JSON', detail: 'Please check your payload syntax.' });
      setLoading(false);
      return;
    }

    try {
      const res = await submitEvent(parsed, simulateFailure);
      if (res.status === 'already_processed') {
        setStatus({ type: 'duplicate', message: 'Duplicate detected', detail: `Hash: ${res.eventHash}` });
      } else if (simulateFailure) {
        setStatus({ type: 'simulated', message: 'Failure simulated', detail: res.error });
      } else {
        setStatus({ type: 'success', message: 'Event processed', detail: `Hash: ${res.eventHash}` });
        onSuccess?.();
      }
    } catch (err) {
      const errData = err.response?.data;
      if (simulateFailure && err.response?.status === 500) {
        setStatus({ type: 'simulated', message: 'Failure simulated ✓', detail: errData?.error || 'DB write aborted' });
      } else {
        setStatus({
          type: 'error',
          message: errData?.error || 'Request failed',
          detail: errData?.reason || errData?.detail || err.message,
        });
        onSuccess?.(); // refresh to show failed events
      }
    }
    setLoading(false);
  }

  const statusStyles = {
    success: 'border-[--accent] bg-[--accent-dim] text-[--accent]',
    duplicate: 'border-[--info] bg-[--info-dim] text-[--info]',
    error: 'border-[--danger] bg-[--danger-dim] text-[--danger]',
    simulated: 'border-[--warn] bg-[--warn-dim] text-[--warn]',
  };

  return (
    <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[--text-secondary] uppercase tracking-widest">
          Event Ingestion
        </h2>
        <div className="flex gap-2 flex-wrap">
          {SAMPLE_EVENTS.map((s) => (
            <button
              key={s.label}
              onClick={() => setInput(s.value)}
              className="text-xs px-2 py-1 rounded border border-[--border-bright] text-[--text-secondary] hover:border-[--accent] hover:text-[--accent] transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        className="w-full h-44 rounded-lg border border-[--border-bright] bg-[--bg] text-[--text-primary] mono text-xs p-3 resize-none focus:outline-none focus:border-[--accent] transition-colors"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        placeholder="Paste raw JSON event here..."
      />

      {/* Simulate failure toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSimulateFailure(!simulateFailure)}
          className={`relative w-10 h-5 rounded-full transition-colors ${simulateFailure ? 'bg-[--danger]' : 'bg-[--border-bright]'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${simulateFailure ? 'translate-x-5' : ''}`}
          />
        </button>
        <span className="text-sm text-[--text-secondary]">
          Simulate DB failure
          {simulateFailure && (
            <span className="ml-2 text-[--danger] text-xs">(next request will intentionally fail)</span>
          )}
        </span>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-[--accent] text-[--bg] font-semibold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
      >
        {loading ? 'Submitting...' : 'Submit Event'}
      </button>

      {status && (
        <div className={`rounded-lg border p-3 text-sm fade-up ${statusStyles[status.type]}`}>
          <span className="font-semibold">{status.message}</span>
          {status.detail && (
            <div className="mono text-xs mt-1 opacity-70 break-all">{status.detail}</div>
          )}
        </div>
      )}
    </div>
  );
}
