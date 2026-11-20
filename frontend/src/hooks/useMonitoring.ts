import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api.client';
import type { AuditEvent, PolicyDecision } from '../types';
import { ENV } from '../config/env';

export function useMonitoring(isAutoPolling: boolean, decisionFilter?: PolicyDecision | string) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isInitialMount = useRef(true);

  const fetchEvents = useCallback(async (isManual: boolean = false) => {
    try {
      if (isInitialMount.current || isManual) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const data = await api.listAuditEvents({
        decision: decisionFilter || undefined,
        limit: 50,
      });
      if (Array.isArray(data)) {
        setEvents((prev) => {
          // Guard against transient empty serverless container responses
          if (data.length === 0 && prev.length > 0) {
            return prev;
          }
          return data;
        });
      }
    } catch (err) {
      console.error('Failed to query live telemetry stream:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      isInitialMount.current = false;
    }
  }, [decisionFilter]);

  useEffect(() => {
    fetchEvents();
    if (!isAutoPolling) return;
    const interval = setInterval(() => fetchEvents(false), ENV.POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchEvents, isAutoPolling]);

  return {
    events,
    loading,
    isRefreshing,
    refresh: () => fetchEvents(true),
  };
}
