import { useState, useEffect, useCallback } from 'react';
import { getWorkflow } from '../api/client';
import socket from '../api/socket';
import { mergeDeep } from '../utils/helpers';
import { MOCK_WORKFLOW_DETAIL, MOCK_FAILED_WORKFLOW } from '../utils/mockData';

const MOCK_MAP = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': MOCK_WORKFLOW_DETAIL,
  'd4e5f6a7-b8c9-0123-defa-234567890123': MOCK_FAILED_WORKFLOW,
};

export function useWorkflow(id) {
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWorkflow = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkflow(id);
      setWorkflow(data);
    } catch (err) {
      console.warn('[useWorkflow] API unavailable, using mock data:', err.message);
      // Fallback to mock data
      const mock = MOCK_MAP[id] || MOCK_WORKFLOW_DETAIL;
      setWorkflow({ ...mock, id });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!id) return;

    socket.emit('subscribe', id);

    const handleUpdate = (patch) => {
      setWorkflow((prev) => {
        if (!prev) return prev;
        return mergeDeep(prev, patch);
      });
    };

    socket.on('workflow:update', handleUpdate);

    return () => {
      socket.emit('unsubscribe', id);
      socket.off('workflow:update', handleUpdate);
    };
  }, [id]);

  const refetch = useCallback(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  return { workflow, loading, error, refetch };
}

export default useWorkflow;
