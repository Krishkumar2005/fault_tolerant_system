import axios from 'axios';
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
});

export async function submitEvent(payload, simulateFailure = false) {
  const response = await api.post('/events', payload, {
    headers: {
      'Content-Type': 'application/json',
      ...(simulateFailure ? { 'X-Simulate-Failure': 'true' } : {}),
    },
  });
  return response.data;
}

export async function fetchProcessedEvents(params = {}) {
  const response = await api.get('/events', { params });
  return response.data;
}

export async function fetchFailedEvents() {
  const response = await api.get('/events/failed');
  return response.data;
}

export async function fetchAggregations(params = {}) {
  const response = await api.get('/aggregations', { params });
  return response.data;
}
