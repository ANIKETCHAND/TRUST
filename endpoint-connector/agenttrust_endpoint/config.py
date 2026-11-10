import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

CONFIG_FILE_PATH = Path("./endpoint_config.json")


class EndpointConfig:
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or CONFIG_FILE_PATH
        self.gateway_url: str = "http://localhost:8080/api/v1"
        self.device_id: Optional[str] = None
        self.device_token: Optional[str] = None
        self.hostname: Optional[str] = None
        self.heartbeat_interval: int = 30  # seconds
        self.telemetry_interval: int = 15  # seconds
        self.load()

    def load(self):
        if self.config_path.is_file():
            try:
                data = json.loads(self.config_path.read_text(encoding="utf-8"))
                self.gateway_url = data.get("gateway_url", self.gateway_url)
                self.device_id = data.get("device_id")
                self.device_token = data.get("device_token")
                self.hostname = data.get("hostname")
                self.heartbeat_interval = data.get("heartbeat_interval", self.heartbeat_interval)
            except Exception:
                pass

    def save(self):
        data = {
            "gateway_url": self.gateway_url,
            "device_id": self.device_id,
            "device_token": self.device_token,
            "hostname": self.hostname,
            "heartbeat_interval": self.heartbeat_interval,
            "telemetry_interval": self.telemetry_interval,
        }
        self.config_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    @property
    def is_enrolled(self) -> bool:
        return bool(self.device_id and self.device_token)
