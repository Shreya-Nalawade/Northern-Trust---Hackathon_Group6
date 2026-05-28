import { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollText } from 'lucide-react';
import { getWorkflowLogs } from '../../api/client';
import { getEventConfig } from '../../utils/helpers';
import { MOCK_WORKFLOW_LOGS } from '../../utils/mockData';
import { format } from 'date-fns';

export function EventLog({ workflowId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const data = await getWorkflowLogs(workflowId);
      setEvents(data.events || []);
    } catch {
      setEvents(MOCK_WORKFLOW_LOGS.events);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="event-log">
      <div className="event-log__header">
        <ScrollText size={16} />
        <h4 className="event-log__title">Event Log</h4>
        <span className="event-log__count">{events.length} events</span>
      </div>

      <div className="event-log__body" ref={scrollRef}>
        {loading ? (
          <div className="event-log__loading">Loading events…</div>
        ) : events.length === 0 ? (
          <div className="event-log__empty">No events yet</div>
        ) : (
          <div className="event-log__list">
            {events.map((event, idx) => {
              const config = getEventConfig(event.event_type);
              return (
                <div key={event.id || idx} className="event-log__entry">
                  <div className="event-log__timeline">
                    <div
                      className="event-log__dot"
                      style={{ backgroundColor: config.color }}
                    />
                    {idx < events.length - 1 && <div className="event-log__line" />}
                  </div>
                  <div className="event-log__content">
                    <div className="event-log__entry-header">
                      <span className="event-log__icon">{config.icon}</span>
                      <span
                        className="event-log__type"
                        style={{ color: config.color }}
                      >
                        {config.label}
                      </span>
                      <span className="event-log__time">
                        {event.created_at
                          ? format(new Date(event.created_at), 'HH:mm:ss')
                          : '—'}
                      </span>
                    </div>
                    {event.payload && (
                      <div className="event-log__payload">
                        {Object.entries(event.payload)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default EventLog;
