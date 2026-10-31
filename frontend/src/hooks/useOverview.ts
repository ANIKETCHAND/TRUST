import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.client';
import type { OverviewStatsResponse } from '../types';
import { ENV } from '../config/env';

export function useOverview() {
  const [data, setData] = useState<OverviewStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getOverviewStats();
      setData(res);
    } catch (err: any) {
      const msg = err.message || 'Failed to aggregate security telemetry';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, ENV.TELEMETRY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return {
    data,
    loading,
    error,
    refresh: fetchStats,
  };
}
