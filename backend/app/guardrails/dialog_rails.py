"""
Dialog Rails: NVIDIA NeMo-Style Dialogue & Execution Flow Constraints.
Enforces deterministic state-machine transitions across multi-tool agent execution flows.
Prevents:
- Out-of-order tool chaining (e.g., immediate database query -> outbound HTTP API exfiltration)
- Unauthorized tool sequence escalation
- Excessive execution loops / recursive agent invocation cycles
"""

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple


@dataclass
class DialogRailResult:
    allowed: bool
    current_state: str
    next_state: str
    transition: str
    history_depth: int
    reason: Optional[str] = None
    violation_code: Optional[str] = None


class DialogRails:
    """
    Tier-2 Guardrails: Dialog & Execution Rails
    Maintains session state and enforces permitted transition graphs.
    """

    MAX_TOOL_CALLS_PER_SESSION = 50

    # Disallowed direct transitions: (previous_tool, next_tool)
    # Direct database read to external outbound HTTP request without intermediate processing
    DISALLOWED_DIRECT_CHAINS = {
        ("postgres_tool", "http_api_tool"): "Direct Database-to-External API egress detected without intermediate review or transformation rail.",
        ("db_tool", "http_api_tool"): "Direct Database-to-External API egress detected without intermediate review or transformation rail.",
    }

    # High-risk operations requiring prior state preparation
    DESTRUCTIVE_OPERATIONS = {
        ("filesystem_tool", "delete_file"),
        ("db_tool", "drop_table"),
    }

    SESSION_TIMEOUT_SECONDS = 900  # 15 minutes of inactivity resets session

    def __init__(self):
        # session_id -> list of (tool_name, operation, timestamp)
        self._session_history: Dict[str, List[Tuple[str, str, float]]] = defaultdict(list)
        # agent_id -> list of (tool_name, operation, timestamp)
        self._agent_history: Dict[str, List[Tuple[str, str, float]]] = defaultdict(list)
        # agent_id -> current state
        self._agent_state: Dict[str, str] = defaultdict(lambda: "INITIAL")

    def reset_session(self, session_id: str):
        """Clears execution history for a given session."""
        if session_id in self._session_history:
            del self._session_history[session_id]

    def reset_agent(self, agent_id: str):
        """Clears execution history for a given agent."""
        if agent_id in self._agent_history:
            del self._agent_history[agent_id]
        if agent_id in self._agent_state:
            del self._agent_state[agent_id]

    def get_session_history(self, session_id: str) -> List[Tuple[str, str, float]]:
        return list(self._session_history.get(session_id, []))

    def _prune_stale_sessions(self):
        """Removes sessions whose last activity exceeds TTL to prevent memory leaks."""
        now = time.time()
        stale = [
            sid for sid, h in self._session_history.items()
            if h and (now - h[-1][2] > self.SESSION_TIMEOUT_SECONDS)
        ]
        for sid in stale:
            del self._session_history[sid]

        stale_agents = [
            aid for aid, h in self._agent_history.items()
            if h and (now - h[-1][2] > self.SESSION_TIMEOUT_SECONDS)
        ]
        for aid in stale_agents:
            del self._agent_history[aid]

    def evaluate_transition(
        self,
        agent_id: str,
        session_id: str,
        tool_name: str,
        operation: str,
        context: Optional[Dict[str, Any]] = None
    ) -> DialogRailResult:
        """
        Validates state machine transition for the requested action.
        Evaluates both session-scoped history and authenticated agent history to prevent session evasion.
        """
        now = time.time()
        if len(self._session_history) > 200 or len(self._agent_history) > 200:
            self._prune_stale_sessions()

        history = self._session_history[session_id]
        if history and (now - history[-1][2] > self.SESSION_TIMEOUT_SECONDS):
            self.reset_session(session_id)
            history = self._session_history[session_id]

        agent_hist = self._agent_history[agent_id]
        if agent_hist and (now - agent_hist[-1][2] > self.SESSION_TIMEOUT_SECONDS):
            self.reset_agent(agent_id)
            agent_hist = self._agent_history[agent_id]

        effective_history = history if history else agent_hist
        current_state = f"{effective_history[-1][0]}:{effective_history[-1][1]}" if effective_history else self._agent_state[agent_id]
        new_state = f"{tool_name}:{operation}"
        history_depth = len(history)

        # 1. Check max execution depth / loop limit
        if history_depth >= self.MAX_TOOL_CALLS_PER_SESSION:
            return DialogRailResult(
                allowed=False,
                current_state=current_state,
                next_state=new_state,
                transition=f"{current_state} -> {new_state}",
                history_depth=history_depth,
                reason=f"Dialog Rail Violation: Session exceeded maximum execution depth ({self.MAX_TOOL_CALLS_PER_SESSION} tool calls). Potential recursive loop.",
                violation_code="MAX_EXECUTION_DEPTH_EXCEEDED"
            )

        # 2. Check disallowed tool chaining across session history AND agent history (SEC-08)
        checked_histories = [h for h in [history, agent_hist] if h]
        for h in checked_histories:
            last_tool, last_op, _ = h[-1]
            disallowed_key = (last_tool, tool_name)
            
            # Check if direct chain is prohibited
            if disallowed_key in self.DISALLOWED_DIRECT_CHAINS:
                if not (context and context.get("bypass_dialog_rails") is True):
                    return DialogRailResult(
                        allowed=False,
                        current_state=f"{last_tool}:{last_op}",
                        next_state=new_state,
                        transition=f"{last_tool} -> {tool_name}",
                        history_depth=history_depth,
                        reason=f"Dialog Rail Violation: {self.DISALLOWED_DIRECT_CHAINS[disallowed_key]}",
                        violation_code="FORBIDDEN_TOOL_CHAIN"
                    )

        # 3. Check destructive operations without prior inspection
        if (tool_name, operation) in self.DESTRUCTIVE_OPERATIONS:
            if not effective_history:
                return DialogRailResult(
                    allowed=False,
                    current_state=current_state,
                    next_state=new_state,
                    transition=f"{current_state} -> {new_state}",
                    history_depth=history_depth,
                    reason=f"Dialog Rail Violation: Destructive operation '{tool_name}:{operation}' cannot be invoked without a prior reconnaissance/read step in the session.",
                    violation_code="UNPREPARED_DESTRUCTIVE_ACTION"
                )

        # Record valid transition in both session and agent-level ledgers
        self._session_history[session_id].append((tool_name, operation, now))
        self._agent_history[agent_id].append((tool_name, operation, now))
        self._agent_state[agent_id] = new_state

        return DialogRailResult(
            allowed=True,
            current_state=current_state,
            next_state=new_state,
            transition=f"{current_state} -> {new_state}",
            history_depth=history_depth + 1
        )


dialog_rails = DialogRails()
