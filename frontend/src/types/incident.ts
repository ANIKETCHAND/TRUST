export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface SecurityIncident {
  id: string;
  audit_event_id?: string;
  agent_id?: string;
  severity: IncidentSeverity;
  title: string;
  description: string;
  status: IncidentStatus;
  resolution_notes?: string;
  incident_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type Incident = SecurityIncident;

export interface IncidentFilterParams {
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  limit?: number;
}
