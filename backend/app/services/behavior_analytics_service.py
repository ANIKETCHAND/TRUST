from collections import defaultdict, deque
from datetime import datetime, timezone
import math
import time
from typing import Any, Dict, List, Optional

from app.services.ml_security_model import MLSecurityModelService


class BehaviorAnalyticsService:
    """
    Agent Behavior Analytics Service (Section 15, Page 10).
    Profiles normal agent behavioral baselines, monitors tool sequences,
    calculates real-time anomaly deviations, and generates alerts.
    """

    def __init__(self):
        # agent_id -> list of tool execution records
        self._history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=200))
        # agent_id -> tool_name counts
        self._tool_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # agent_id -> failure count
        self._error_counts: Dict[str, int] = defaultdict(int)

    def record_activity(
        self,
        agent_id: str,
        tool_name: str,
        operation: str,
        duration_ms: float = 50.0,
        success: bool = True,
        payload_bytes: int = 250
    ) -> None:
        """Records a completed or blocked tool execution into the behavioral profile."""
        now = time.time()
        record = {
            "timestamp": now,
            "tool": tool_name,
            "operation": operation,
            "duration_ms": duration_ms,
            "success": success,
            "bytes": payload_bytes
        }
        self._history[agent_id].append(record)
        self._tool_counts[agent_id][tool_name] += 1
        if not success:
            self._error_counts[agent_id] += 1

    def get_agent_profile(self, agent_id: str) -> Dict[str, Any]:
        """Calculates behavioral statistics, deviation from baseline, and ML anomaly score."""
        history = list(self._history[agent_id])
        now = time.time()

        if not history:
            # Clean baseline profile for newly registered agent
            return {
                "agent_id": agent_id,
                "total_recorded_actions": 0,
                "current_rate_per_min": 0.0,
                "error_rate_pct": 0.0,
                "avg_duration_ms": 0.0,
                "tool_distribution": {},
                "anomaly_score": 0.0,
                "behavioral_status": "NORMAL_BASELINE",
                "alerts": [],
                "established_baseline": False
            }

        # Calculate rate in past 60 seconds
        past_60s = [h for h in history if now - h["timestamp"] <= 60.0]
        rate_per_min = float(len(past_60s))

        # Average latency and payload bytes
        avg_duration = sum(h["duration_ms"] for h in history) / len(history)
        avg_bytes = sum(h["bytes"] for h in history) / len(history)

        # Error rate
        failures = sum(1 for h in history if not h["success"])
        error_rate = (failures / len(history)) * 100.0

        # Tool distribution percentages
        total_calls = len(history)
        tool_dist = {
            t: round((count / total_calls) * 100, 1)
            for t, count in self._tool_counts[agent_id].items()
        }

        # Query ML Model C (Isolation Forest)
        ml_svc = MLSecurityModelService.get_instance()
        anomaly_res = ml_svc.detect_behavioral_anomaly(
            calls_per_min=rate_per_min,
            avg_payload_bytes=avg_bytes,
            error_rate_pct=error_rate,
            execution_duration_ms=avg_duration
        )

        alerts = []
        if rate_per_min > 20.0:
            alerts.append(f"High Request Rate: {rate_per_min:.0f} calls/min exceeds normal 10 calls/min baseline.")
        if error_rate > 15.0:
            alerts.append(f"Elevated Failure Rate: {error_rate:.1f}% operations blocked or failed.")
        if anomaly_res["is_anomaly"]:
            alerts.append(f"Isolation Forest Anomaly Detected: Score {anomaly_res['anomaly_score']}/100.")

        return {
            "agent_id": agent_id,
            "total_recorded_actions": total_calls,
            "current_rate_per_min": round(rate_per_min, 1),
            "error_rate_pct": round(error_rate, 1),
            "avg_duration_ms": round(avg_duration, 1),
            "tool_distribution": tool_dist,
            "anomaly_score": anomaly_res["anomaly_score"],
            "behavioral_status": anomaly_res["status"],
            "alerts": alerts,
            "established_baseline": total_calls >= 10
        }

    def get_overview(self) -> Dict[str, Any]:
        """Aggregates behavioral trends across all enrolled agents."""
        total_agents_monitored = len(self._history)
        all_calls = sum(len(h) for h in self._history.values())
        high_anomaly_agents = 0

        for agent_id in list(self._history.keys()):
            prof = self.get_agent_profile(agent_id)
            if prof["anomaly_score"] >= 65.0:
                high_anomaly_agents += 1

        return {
            "monitored_agents_count": total_agents_monitored,
            "total_analyzed_operations": all_calls,
            "anomalous_agents_count": high_anomaly_agents,
            "anomaly_detection_engine": "IsolationForest-v2.1",
            "active_behavioral_windows": len(self._history)
        }


behavior_analytics_service = BehaviorAnalyticsService()
