# Fault-Tolerant Data Ingestion System

A backend-first, production-style event ingestion pipeline that handles unreliable clients, schema drift, retries, and partial failures safely.

---

## Setup & Run

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`) on port 27017

### Backend

```bash
cd backend
cp .env.example .env   # edit MONGODB_URI if needed
npm install
npm run dev            # runs on :3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # runs on :5173, proxies API calls to :3001
```

Open `http://localhost:5173`

---

## Architecture

```
POST /events
  └── Save raw event (RECEIVED)           ← never lose data
      └── Normalize payload               ← field aliasing + type coercion
          ├── [fail] → failed_events, raw.status = FAILED
          └── Generate SHA-256 hash       ← deterministic dedup key
              └── Insert processed_event  ← unique index on eventHash
                  ├── [11000 duplicate] → return "already_processed"
                  ├── [other DB error]  → failed_events, raw.status = FAILED
                  └── [success]         → raw.status = PROCESSED
```

---

## Answers to Required Questions

### What assumptions were you made?

1. **Source is always present.** The `source` (or `client_id`) field is the only truly required field. An event with no source cannot be attributed and is rejected.

2. **Amount is required and must be numeric.** Aggregation is meaningless without a parseable amount. Events with unparseable amounts are routed to `failed_events`.

3. **Timestamp is required.** Time-range filtering and deduplication depend on it. Unparseable timestamps cause rejection.

4. **Extra fields are silently dropped.** Unknown fields from clients are preserved in `raw_events` but not in `processed_events`. This keeps the canonical schema clean without breaking on schema additions.

5. **A single process, single MongoDB node.** No distributed coordination needed. The unique index on `eventHash` is the sole dedup mechanism — this works correctly for a single Mongo primary.

6. **Raw events are not deduplicated.** `raw_events` is an append-only audit log. Each retry from a client creates a new raw event row. Only `processed_events` enforces uniqueness.

---

### How does the system prevent double counting?

**Deterministic hashing + a unique DB index.**

Every normalized event is hashed using SHA-256 over four fields:
```
hash = SHA256(client_id | metric | amount | timestamp)
```

This hash is stored as `eventHash` in `processed_events` with a `unique: true` index.

If the same logical event arrives again (retry, client resend, network duplicate):
1. Normalization produces the same canonical output
2. The same hash is generated
3. MongoDB rejects the insert with error code `11000` (duplicate key)
4. We return `200 already_processed` — no double counting, no crash

Why these four fields? They define the identity of an event: *who sent it, what type it is, how much, and when*. Two events identical on all four are duplicates by definition.

---

### What happens if the database fails mid-request?

The pipeline is designed around **raw-first persistence**:

**Scenario: event received → validated → DB write fails → client retries**

1. **Raw event is saved first** (before normalization). If this fails, we return 500 and nothing is stored — consistent.

2. **If the processed_event insert fails** (after raw is saved):
   - Raw event is marked `FAILED`
   - A `failed_event` record is created with the error reason
   - Client gets a 500 response and retries

3. **On retry**:
   - A new raw event is saved (raw log is append-only — this is fine)
   - Normalization succeeds again (deterministic)
   - Same hash is generated
   - If the first attempt *did* partially write before crashing, the duplicate key error catches it → `already_processed`
   - If the first attempt wrote nothing, this attempt succeeds normally

**Result**: No data loss, no double counting, consistent state. The worst case is a stale `FAILED` raw event and an orphaned failed_event record — both harmless and inspectable.

---

### What would break first at scale?

**1. The aggregation queries (most likely first)**

`GET /aggregations` runs three full-collection scans on `processed_events` on every request. With millions of events, this becomes slow. Fix: pre-aggregate into a summary collection on write, or add compound indexes on `(client_id, timestamp)` and `(metric, timestamp)`.

**2. The unique index on eventHash under high write concurrency**

Mongo's unique index handles concurrent inserts correctly (last writer gets the 11000 error), but at very high throughput, write contention on the index increases latency. Fix: shard on `eventHash` or move dedup to an application-level cache (Redis set) for hot paths, with DB as the source of truth.

**3. raw_events growing unboundedly**

Every retry creates a new raw event row. At scale this collection balloons. Fix: TTL index to expire raw events after N days, or archive to cold storage.

**4. Single MongoDB node**

No replica set means a node failure = downtime. Fix: replica set for failover, read preference secondaries for aggregation queries.

---

## API Reference

```
POST   /events              Ingest a raw event
                            Header: X-Simulate-Failure: true  (optional)

GET    /events              List processed events
       ?client=client_A
       ?from=2024-01-01
       ?to=2024-12-31
       ?limit=50

GET    /events/failed       List failed/rejected events

GET    /aggregations        Aggregated totals + breakdowns
       ?client=client_A
       ?from=2024-01-01
       ?to=2024-12-31
```

## Sample Requests

```bash
# Standard event
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{"source":"client_A","payload":{"metric":"purchase","amount":"1200","timestamp":"2024/01/01"}}'

# Different field names (client_B style)
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{"source":"client_B","payload":{"event_type":"refund","price":350,"time":"01-15-2024"}}'

# Simulate failure
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: true" \
  -d '{"source":"client_A","payload":{"metric":"purchase","amount":"500","timestamp":"2024-02-01"}}'

# Retry (same payload) — should return already_processed
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{"source":"client_A","payload":{"metric":"purchase","amount":"1200","timestamp":"2024/01/01"}}'
```
