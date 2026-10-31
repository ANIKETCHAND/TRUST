from abc import ABC, abstractmethod
from typing import Any, Dict, List


class BaseTool(ABC):
    name: str
    display_name: str
    category: str
    supported_operations: List[str]

    @abstractmethod
    async def execute(self, operation: str, resource: str, parameters: Dict[str, Any]) -> Any:
        """Execute the protected tool operation safely."""
        pass
