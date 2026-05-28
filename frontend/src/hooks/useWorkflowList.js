import { useState, useEffect, useCallback, useRef } from 'react';
import { listWorkflows } from '../api/client';
import { MOCK_WORKFLOWS } from '../utils/mockData';

const POLL_INTERVAL = 3000; // Refresh list every 3 seconds

export function useWorkflowList(params = {}) {
  const [workflows, setWorkflows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchWorkflows = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    setError(null);
    try {
      const data = await listWorkflows(params);
      setWorkflows(data.executions || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.warn('[useWorkflowList] API unavailable, using mock data:', err.message);
      // Fallback to mock data with client-side filtering
      let filtered = MOCK_WORKFLOWS.executions;
      if (params.state) {
        filtered = filtered.filter((w) => w.state === params.state);
      }
      setWorkflows(filtered);
      setTotal(filtered.length);
    } finally {
      setLoading(false);
    }
  }, [params.state, params.limit]);

  // Initial fetch
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Poll for updates so the list stays fresh
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchWorkflows(true);
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchWorkflows]);

  return { workflows, total, loading, error, refetch: () => fetchWorkflows(false) };
}

export default useWorkflowList;
