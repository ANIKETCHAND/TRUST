import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.client';
import type { AuditEvent, PolicyDecision } from '../types';
import { ENV } from '../config/env';

export function useMonitoring(isAutoPolling: boolean, decisionFilter?: PolicyDecision | string) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.listAuditEvents({
        decision: decisionFilter || undefined,
        limit: 50,
      });
      setEvents(data);
    } catch (err) {
      console.error('Failed to query live telemetry stream:', err);
    } finally {
      setLoading(false);
    }
  }, [decisionFilter]);

  useEffect(() => {
    fetchEvents();
    if (!isAutoPolling) return;
    const interval = setInterval(fetchEvents, ENV.POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchEvents, isAutoPolling]);

  return {
    events,
    loading,
    refresh: fetchEvents,
  };
}
