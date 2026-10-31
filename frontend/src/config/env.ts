/**
 * Centralized environment configuration.
 * Avoids hardcoding ports, URLs, or timing constants across code.
 */
export const ENV = {
  API_BASE_URL: (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1',
  POLL_INTERVAL_MS: Number(import.meta.env.VITE_POLL_INTERVAL_MS) || 3000,
  TELEMETRY_REFRESH_MS: Number(import.meta.env.VITE_TELEMETRY_REFRESH_MS) || 10000,
  APP_NAME: 'AgentTrust AI Security Platform',
  APP_VERSION: '0.1.0',
} as const;
