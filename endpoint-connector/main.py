import argparse
import asyncio
import logging
import sys
from agenttrust_endpoint.client import EndpointClient
from agenttrust_endpoint.collector import EndpointTelemetryCollector
from agenttrust_endpoint.config import EndpointConfig
from agenttrust_endpoint.service import EndpointConnectorDaemon

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("agenttrust.endpoint")


async def enroll_cmd(args):
    config = EndpointConfig()
    if args.gateway:
        config.gateway_url = args.gateway
    client = EndpointClient(config)
    try:
        data = await client.enroll(enrollment_secret=args.secret)
        print(f"Enrollment successful!")
        print(f"  Device ID:    {data['device_id']}")
        print(f"  Hostname:     {data['hostname']}")
        print(f"  Token Prefix: {data['token_prefix']}")
    except Exception as e:
        print(f"Enrollment failed: {e}", file=sys.stderr)
        sys.exit(1)


async def status_cmd(args):
    config = EndpointConfig()
    print("AgentTrust Endpoint Connector Status:")
    print(f"  Enrolled:      {config.is_enrolled}")
    print(f"  Device ID:     {config.device_id or 'None'}")
    print(f"  Hostname:      {config.hostname or 'None'}")
    print(f"  Gateway URL:   {config.gateway_url}")
    if config.is_enrolled:
        client = EndpointClient(config)
        try:
            hb = await client.send_heartbeat()
            print(f"  Core Status:   ONLINE (Status: {hb.get('status')})")
            print(f"  Is Contained:  {hb.get('is_contained')}")
        except Exception as e:
            print(f"  Core Status:   UNREACHABLE ({e})")


async def test_telemetry_cmd(args):
    config = EndpointConfig()
    if not config.is_enrolled:
        print("Endpoint not enrolled. Enroll first.", file=sys.stderr)
        sys.exit(1)
    client = EndpointClient(config)
    collector = EndpointTelemetryCollector()
    events = collector.generate_synthetic_agent_telemetry()
    try:
        res = await client.send_telemetry(events)
        print(f"Synthetic telemetry successfully sent: {res}")
    except Exception as e:
        print(f"Failed to submit telemetry: {e}", file=sys.stderr)
        sys.exit(1)


async def start_cmd(args):
    config = EndpointConfig()
    daemon = EndpointConnectorDaemon(config)
    await daemon.start()


def main():
    parser = argparse.ArgumentParser(description="AgentTrust Endpoint Connector CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # enroll
    enroll_parser = subparsers.add_parser("enroll", help="Enroll endpoint with AgentTrust Core")
    enroll_parser.add_argument("--secret", required=True, help="Enrollment secret key")
    enroll_parser.add_argument("--gateway", help="AgentTrust Gateway URL")

    # status
    subparsers.add_parser("status", help="Check endpoint enrollment and connection status")

    # test-telemetry
    subparsers.add_parser("test-telemetry", help="Send a synthetic agent workflow event")

    # start
    subparsers.add_parser("start", help="Start continuous endpoint telemetry service daemon")

    args = parser.parse_args()

    if args.command == "enroll":
        asyncio.run(enroll_cmd(args))
    elif args.command == "status":
        asyncio.run(status_cmd(args))
    elif args.command == "test-telemetry":
        asyncio.run(test_telemetry_cmd(args))
    elif args.command == "start":
        asyncio.run(start_cmd(args))


if __name__ == "__main__":
    main()
