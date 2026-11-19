"""
Model Context Protocol (MCP) Integration with CrossX Security Gateway (Section 19).
Demonstrates:
1. Intercepting tools/call JSON-RPC messages with CrossXMCPInterceptor.
2. Allowing legitimate tool execution requests.
3. Catching and blocking malicious tool calls targeting sensitive infrastructure.
"""

from crossx import CrossXClient, CrossXBlockedError
from crossx.adapters import CrossXMCPInterceptor


def main():
    crossx = CrossXClient(
        endpoint="http://localhost:8000",
        api_key="agk_live_test_key_sample"
    )

    mcp_interceptor = CrossXMCPInterceptor(client=crossx, server_name="mcp_postgres_cluster")
    print(f"MCP Interceptor listening for server: {mcp_interceptor.server_name}")

    # 1. Safe MCP tool invocation
    safe_mcp_call = mcp_interceptor.intercept_mcp_call(
        tool_name="db_tool",
        arguments={"resource": "SELECT 1;", "operation": "query_select"}
    )
    print("Safe MCP call decision:", safe_mcp_call.get("decision", "ALLOWED"))

    # 2. Blocked MCP tool invocation targeting /etc/shadow
    try:
        print("\nAttempting unauthorized MCP call targeting '/etc/shadow'...")
        mcp_interceptor.intercept_mcp_call(
            tool_name="filesystem_tool",
            arguments={"resource": "/etc/shadow", "operation": "read_file"}
        )
        print("WARNING: MCP call was not blocked!")
    except CrossXBlockedError as e:
        print("SUCCESS: MCP tool call BLOCKED by CrossX Interceptor!")
        print("Reason:", e.message)


if __name__ == "__main__":
    main()
