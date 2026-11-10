import asyncio
import logging
from agenttrust_endpoint.client import EndpointClient
from agenttrust_endpoint.collector import EndpointTelemetryCollector
from agenttrust_endpoint.config import EndpointConfig

logger = logging.getLogger("agenttrust.endpoint.service")


class EndpointConnectorDaemon:
    def __init__(self, config: EndpointConfig):
        self.config = config
        self.client = EndpointClient(config)
        self.collector = EndpointTelemetryCollector()
        self.is_running = False
        self.is_contained = False
        self.containment_reason = None

    async def start(self):
        if not self.config.is_enrolled:
            raise RuntimeError("Endpoint is not enrolled. Run `python main.py enroll` first.")

        self.is_running = True
        logger.info(f"AgentTrust Endpoint Connector starting on {self.config.hostname}...")

        heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        telemetry_task = asyncio.create_task(self._telemetry_loop())

        try:
            await asyncio.gather(heartbeat_task, telemetry_task)
        except asyncio.CancelledError:
            logger.info("Endpoint daemon shutting down.")

    def _apply_containment(self, reason: str):
        self.is_contained = True
        self.containment_reason = reason
        logger.warning(f"[CONTAINMENT ACTIVE] Device isolated from network: {reason}")

    def _release_containment(self):
        self.is_contained = False
        self.containment_reason = None
        logger.info("[CONTAINMENT RELEASED] Normal operations restored.")

    async def _heartbeat_loop(self):
        while self.is_running:
            try:
                res = await self.client.send_heartbeat()
                logger.debug(f"Heartbeat OK: status={res.get('status')}")
                server_contained = bool(res.get("is_contained", False))
                if server_contained and not self.is_contained:
                    self._apply_containment(res.get("containment_reason", "Administrator Containment Order"))
                elif not server_contained and self.is_contained:
                    self._release_containment()
            except Exception as e:
                logger.warning(f"Heartbeat failure: {e}")
            await asyncio.sleep(self.config.heartbeat_interval)

    async def _telemetry_loop(self):
        while self.is_running:
            try:
                events = self.collector.collect_agent_processes()
                if self.is_contained:
                    for ev in events:
                        ev["status"] = "CONTAINED"
                        ev["containment_enforced"] = True
                if events:
                    res = await self.client.send_telemetry(events[:20])
                    logger.debug(f"Telemetry sent: {len(events)} events recorded.")
            except Exception as e:
                logger.warning(f"Telemetry collection error: {e}")
            await asyncio.sleep(self.config.telemetry_interval)
