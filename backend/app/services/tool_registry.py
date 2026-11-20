from typing import Dict, Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.tool import Tool, ToolStatus, ToolCategory
from app.tools.base import BaseTool
from app.tools.filesystem_tool import SandboxFilesystemTool
from app.tools.db_tool import SandboxedDatabaseTool
from app.tools.http_api_tool import SandboxedHttpApiTool
from app.tools.mcp_tool import MCPIntegrationTool
from app.tools.test_lab_tools import (
    SafeCalculatorTool,
    WebSearchTool,
    SecurityEventAnalyzerTool,
    TestEnvDataTool,
)


class ToolRegistryService:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        # Register standard built-in tools
        self.register_builtin_tool(SandboxFilesystemTool())
        self.register_builtin_tool(SandboxedDatabaseTool())
        self.register_builtin_tool(SandboxedHttpApiTool())
        self.register_builtin_tool(MCPIntegrationTool())
        # Register security test lab tools
        self.register_builtin_tool(SafeCalculatorTool())
        self.register_builtin_tool(WebSearchTool())
        self.register_builtin_tool(SecurityEventAnalyzerTool())
        self.register_builtin_tool(TestEnvDataTool())

    def register_builtin_tool(self, tool_instance: BaseTool) -> None:
        self._tools[tool_instance.name] = tool_instance

    def get_tool_handler(self, tool_name: str) -> Optional[BaseTool]:
        if tool_name in ("db_tool", "postgres", "sql_tool"):
            return self._tools.get("postgres_tool")
        if tool_name in ("filesystem", "fs_tool", "sandbox_filesystem"):
            return self._tools.get("filesystem_tool")
        if tool_name in ("http_api", "http_tool", "rest_tool"):
            return self._tools.get("http_api_tool")
        if tool_name in ("calculator", "safe_calculator_tool", "safe_calc"):
            return self._tools.get("safe_calculator")
        if tool_name in ("web_search", "search_tool", "search"):
            return self._tools.get("web_search_tool")
        if tool_name in ("event_analyzer", "threat_analyzer", "security_analyzer"):
            return self._tools.get("security_event_analyzer")
        if tool_name in ("test_env", "test_env_data", "test_data"):
            return self._tools.get("test_env_data_tool")
        return self._tools.get(tool_name)

    async def sync_tools_to_db(self, db: AsyncSession) -> None:
        """Ensures registered tools exist in the database with their metadata."""
        for tool_name, tool_obj in self._tools.items():
            result = await db.execute(select(Tool).where(Tool.name == tool_name))
            db_tool = result.scalars().first()
            category_val = (
                ToolCategory(tool_obj.category) 
                if tool_obj.category in ToolCategory.__members__.values() 
                else ToolCategory.SYSTEM
            )
            if not db_tool:
                new_tool = Tool(
                    name=tool_obj.name,
                    display_name=tool_obj.display_name,
                    category=category_val,
                    status=ToolStatus.ACTIVE,
                    supported_operations=tool_obj.supported_operations,
                    configuration={"sandbox": True},
                    is_protected=True,
                )
                db.add(new_tool)
            else:
                db_tool.supported_operations = tool_obj.supported_operations
                db_tool.display_name = tool_obj.display_name
                db_tool.category = category_val
        await db.commit()


tool_registry = ToolRegistryService()
