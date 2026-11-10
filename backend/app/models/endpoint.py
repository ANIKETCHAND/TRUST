import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from app.models.base import Base


class EndpointStatus(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    CONTAINED = "CONTAINED"
    DECOMMISSIONED = "DECOMMISSIONED"


class ContainmentScope(str, enum.Enum):
    NETWORK_ISOLATION = "NETWORK_ISOLATION"
    PROCESS_SUSPENSION = "PROCESS_SUSPENSION"
    WORKSPACE_RESTRICTION = "WORKSPACE_RESTRICTION"


class EndpointDevice(Base):
    __tablename__ = "endpoint_devices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hostname = Column(String(255), nullable=False, index=True)
    os_platform = Column(String(64), nullable=False, default="windows")  # windows | linux
    os_version = Column(String(128), nullable=True)
    agent_version = Column(String(32), nullable=False, default="0.2.0")
    
    # Cryptographic device identity token hash (SHA-256)
    device_token_hash = Column(String(64), unique=True, nullable=False, index=True)
    device_token_prefix = Column(String(20), nullable=False)
    
    status = Column(Enum(EndpointStatus), default=EndpointStatus.ONLINE, nullable=False)
    ip_address = Column(String(45), nullable=True)
    mac_address = Column(String(32), nullable=True)  # Strictly local segment indicator
    
    last_heartbeat_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    policy_version = Column(String(64), default="v1.0.0", nullable=False)
    enrolled_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    enrolled_by = Column(String(128), default="system", nullable=False)
    
    is_contained = Column(Boolean, default=False, nullable=False)
    containment_reason = Column(Text, nullable=True)
    device_metadata = Column(JSON, default=dict)

    telemetry_events = relationship("EndpointTelemetryEvent", back_populates="device", cascade="all, delete-orphan")
    containment_actions = relationship("EndpointContainmentAction", back_populates="device", cascade="all, delete-orphan")


class EndpointTelemetryEvent(Base):
    __tablename__ = "endpoint_telemetry_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String(36), ForeignKey("endpoint_devices.id", ondelete="CASCADE"), nullable=False, index=True)
    
    event_type = Column(String(64), nullable=False, index=True)  # process_spawn, tool_invocation, file_touch, network_egress
    process_name = Column(String(255), nullable=True)
    process_pid = Column(Integer, nullable=True)
    command_line = Column(Text, nullable=True)
    executable_path = Column(String(1024), nullable=True)
    target_resource = Column(String(1024), nullable=True)
    
    severity = Column(String(32), default="INFO", nullable=False)  # INFO, WARNING, SUSPICIOUS, HIGH
    is_authorized_agent_workflow = Column(Boolean, default=True, nullable=False)
    telemetry_details = Column(JSON, default=dict)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    device = relationship("EndpointDevice", back_populates="telemetry_events")


class EndpointContainmentAction(Base):
    __tablename__ = "endpoint_containment_actions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String(36), ForeignKey("endpoint_devices.id", ondelete="CASCADE"), nullable=False, index=True)
    
    scope = Column(Enum(ContainmentScope), default=ContainmentScope.PROCESS_SUSPENSION, nullable=False)
    action_type = Column(String(64), nullable=False)  # ISOLATE, RELEASE, SUSPEND_AGENT_PROCESS
    reason = Column(Text, nullable=False)
    authorized_by = Column(String(128), nullable=False)
    human_approved = Column(Boolean, default=True, nullable=False)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    released_at = Column(DateTime(timezone=True), nullable=True)
    release_notes = Column(Text, nullable=True)

    device = relationship("EndpointDevice", back_populates="containment_actions")


class BrowserShieldExtension(Base):
    __tablename__ = "browser_shield_extensions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    browser_name = Column(String(64), nullable=False, default="Chrome")
    browser_version = Column(String(64), nullable=True)
    extension_version = Column(String(32), nullable=False, default="0.2.0")
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    token_prefix = Column(String(24), nullable=False)
    status = Column(String(32), default="ACTIVE", nullable=False)
    last_seen_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
