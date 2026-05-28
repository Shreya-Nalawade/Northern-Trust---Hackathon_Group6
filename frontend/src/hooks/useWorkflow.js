import { useState, useEffect, useCallback, useRef } from 'react';
import { getWorkflow } from '../api/client';
import socket from '../api/socket';
import { mergeDeep } from '../utils/helpers';
import { MOCK_WORKFLOW_DETAIL, MOCK_FAILED_WORKFLOW } from '../utils/mockData';

const MOCK_MAP = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': MOCK_WORKFLOW_DETAIL,
  'd4e5f6a7-b8c9-0123-defa-234567890123': MOCK_FAILED_WORKFLOW,
};

const TERMINAL_STATES = ['COMPLETED', 'FAILED', 'CANCELLED'];
const POLL_INTERVAL = 2000; // Poll every 2 seconds while active

export function useWorkflow(id) {
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchWorkflow = useCallback(async () => {
    if (!id) return;
    setLoading((prev) => (prev ? true : false)); // Don't flash loading on polls
    setError(null);
    try {
      const data = await getWorkflow(id);
      setWorkflow(data);
      return data;
    } catch (err) {
      console.warn('[useWorkflow] API unavailable, using mock data:', err.message);
      // Fallback to mock data
      const mock = MOCK_MAP[id] || MOCK_WORKFLOW_DETAIL;
      setWorkflow({ ...mock, id });
      return { ...mock, id };
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial fetch
  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  // Poll while workflow is still active (not in terminal state)
  useEffect(() => {
    if (!id) return;

    const startPolling = () => {
      pollRef.current = setInterval(async () => {
        try {
          const data = await getWorkflow(id);
          setWorkflow(data);

          // Stop polling if workflow reached a terminal state
          if (data && TERMINAL_STATES.includes(data.state)) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch {
          // Ignore poll errors, keep trying
        }
      }, POLL_INTERVAL);
    };

    // Start polling after a short delay to let initial fetch complete
    const timeout = setTimeout(() => {
      // Only start if workflow is not already terminal
      if (!workflow || !TERMINAL_STATES.includes(workflow.state)) {
        startPolling();
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to real-time updates via Socket.IO (bonus on top of polling)
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
