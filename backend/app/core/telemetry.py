import logging
import time
from contextlib import contextmanager
from typing import Any, Dict, Generator, Optional
from app.core.config import settings

logger = logging.getLogger("agenttrust.telemetry")


class TelemetryManager:
    """
    OpenTelemetry Metrics and Tracing Manager:
    Provides structured distributed tracing spans and metrics export for AgentTrust.
    Operates with zero overhead when OTEL is disabled.
    """

    def __init__(self):
        self.enabled = settings.OTEL_ENABLED
        self.service_name = settings.OTEL_SERVICE_NAME
        self.endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT
        self._tracer = None
        self._init_telemetry()

    def _init_telemetry(self):
        if not self.enabled:
            logger.info("OpenTelemetry is disabled in configuration.")
            return

        try:
            # Dynamic import to avoid hard dependency when disabled
            from opentelemetry import trace
            from opentelemetry.sdk.trace import TracerProvider
            from opentelemetry.sdk.resources import Resource
            from opentelemetry.sdk.trace.export import BatchSpanProcessor
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

            resource = Resource.create({"service.name": self.service_name})
            provider = TracerProvider(resource=resource)
            exporter = OTLPSpanExporter(endpoint=self.endpoint, insecure=True)
            provider.add_span_processor(BatchSpanProcessor(exporter))
            trace.set_tracer_provider(provider)
            self._tracer = trace.get_tracer(self.service_name)
            logger.info(f"OpenTelemetry initialized with endpoint {self.endpoint}")
        except Exception as e:
            logger.warning(f"Could not initialize OpenTelemetry: {e}. Falling back to internal metrics.")
            self.enabled = False

    @contextmanager
    def span(self, name: str, attributes: Optional[Dict[str, Any]] = None) -> Generator[Any, None, None]:
        """Context manager to measure latency and trace execution spans."""
        start_time = time.perf_counter()
        span_obj = None

        if self.enabled and self._tracer:
            try:
                span_obj = self._tracer.start_span(name)
                if attributes:
                    for k, v in attributes.items():
                        span_obj.set_attribute(k, str(v))
            except Exception:
                pass

        try:
            yield span_obj
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            if span_obj:
                try:
                    span_obj.set_attribute("duration_ms", duration_ms)
                    span_obj.end()
                except Exception:
                    pass


telemetry = TelemetryManager()
