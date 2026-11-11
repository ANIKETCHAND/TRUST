from typing import Any, Dict, List
from app.tools.base import BaseTool


class MCPIntegrationTool(BaseTool):
    name = "mcp_tool"
    display_name = "Model Context Protocol (MCP) Integration Bridge"
    category = "mcp"
    supported_operations = ["mcp_list_tools", "mcp_call_tool"]

    def __init__(self):
        pass

    async def execute(self, operation: str, resource: str, parameters: Dict[str, Any]) -> Any:
        if operation not in self.supported_operations:
            raise ValueError(f"Unsupported MCP operation '{operation}'")

        if operation == "mcp_list_tools":
            return {
                "protocol": "mcp/1.0",
                "tools": [
                    {
                        "name": "filesystem_tool",
                        "description": "Controlled filesystem tool inside isolated sandbox",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "operation": {"type": "string", "enum": ["read_file", "write_file", "list_directory", "delete_file"]},
                                "resource": {"type": "string"},
                                "parameters": {"type": "object"}
                            },
                            "required": ["operation", "resource"]
                        }
                    },
                    {
                        "name": "postgres_tool",
                        "description": "Controlled relational database tool with SQL safety enforcement",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "operation": {"type": "string", "enum": ["query_select", "query_insert", "query_update", "describe_table"]},
                                "resource": {"type": "string"},
                                "parameters": {"type": "object"}
                            },
                            "required": ["operation", "resource"]
                        }
                    },
                    {
                        "name": "http_api_tool",
                        "description": "Controlled external HTTP requests with SSRF boundary protection",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "operation": {"type": "string", "enum": ["http_get", "http_post"]},
                                "resource": {"type": "string"},
                                "parameters": {"type": "object"}
                            },
                            "required": ["operation", "resource"]
                        }
                    }
                ]
            }

        elif operation == "mcp_call_tool":
            target_tool = parameters.get("tool")
            target_op = parameters.get("operation")
            target_params = parameters.get("parameters") or {}

            registered_mcp_tools = {"filesystem_tool", "postgres_tool", "http_api_tool"}
            if not target_tool or target_tool not in registered_mcp_tools:
                raise ValueError(f"Invalid or unauthorized MCP target tool '{target_tool}'. Supported tools: {sorted(registered_mcp_tools)}")
            if not target_op:
                raise ValueError(f"Missing 'operation' parameter for MCP tool '{target_tool}'")

            return {
                "protocol": "mcp/1.0",
                "status": "routed",
                "target_tool": target_tool,
                "target_operation": target_op,
                "parameters": target_params,
                "resource": resource
            }
