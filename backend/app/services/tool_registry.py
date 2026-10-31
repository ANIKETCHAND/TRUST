from typing import Dict, Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.tool import Tool, ToolStatus, ToolCategory
from app.tools.base import BaseTool
from app.tools.filesystem_tool import SandboxFilesystemTool


class ToolRegistryService:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        # Register standard built-in tools
        self.register_builtin_tool(SandboxFilesystemTool())

    def register_builtin_tool(self, tool_instance: BaseTool) -> None:
        self._tools[tool_instance.name] = tool_instance

    def get_tool_handler(self, tool_name: str) -> Optional[BaseTool]:
        return self._tools.get(tool_name)

    async def sync_tools_to_db(self, db: AsyncSession) -> None:
        """Ensures registered tools exist in the database with their metadata."""
        for tool_name, tool_obj in self._tools.items():
            result = await db.execute(select(Tool).where(Tool.name == tool_name))
            db_tool = result.scalars().first()
            if not db_tool:
                new_tool = Tool(
                    name=tool_obj.name,
                    display_name=tool_obj.display_name,
                    category=ToolCategory(tool_obj.category) if tool_obj.category in ToolCategory.__members__.values() else ToolCategory.SYSTEM,
                    status=ToolStatus.ACTIVE,
                    supported_operations=tool_obj.supported_operations,
                    configuration={"sandbox": True},
                    is_protected=True,
                )
                db.add(new_tool)
        await db.commit()


tool_registry = ToolRegistryService()
