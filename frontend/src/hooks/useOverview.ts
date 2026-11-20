import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api.client';
import type { OverviewStatsResponse } from '../types';
import { ENV } from '../config/env';

export function useOverview() {
  const [data, setData] = useState<OverviewStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  const fetchStats = useCallback(async (isManual: boolean = false) => {
    try {
      if (isInitialMount.current || isManual) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const res = await api.getOverviewStats();
      if (res && res.metrics) {
        setData((prev) => {
          // Guard against transient empty serverless container responses
          const prevCalls = prev?.metrics?.total_monitored_calls ?? (prev?.metrics ? prev.metrics.allowed_operations + prev.metrics.blocked_operations : 0);
          const newCalls = res?.metrics?.total_monitored_calls ?? (res?.metrics ? res.metrics.allowed_operations + res.metrics.blocked_operations : 0);
          if (prevCalls > 0 && newCalls === 0) {
            return prev;
          }
          return res;
        });
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to aggregate security telemetry';
      setError(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      isInitialMount.current = false;
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => fetchStats(false), ENV.TELEMETRY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return {
    data,
    loading,
    isRefreshing,
    error,
    refresh: () => fetchStats(true),
  };
}
