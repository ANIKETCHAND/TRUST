import os
from pathlib import Path
from typing import Any, Dict, List
from app.core.config import settings
from app.tools.base import BaseTool


class SandboxFilesystemTool(BaseTool):
    name = "filesystem_tool"
    display_name = "Sandboxed Filesystem Tool"
    category = "filesystem"
    supported_operations = ["read_file", "write_file", "list_directory", "delete_file"]

    def __init__(self, root_path: Path = None):
        self.root_path = root_path or settings.absolute_sandbox_path
        self.root_path.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, relative_path: str) -> Path:
        # Strip leading slashes to prevent root-anchored path interpretation
        clean_rel = relative_path.lstrip("/\\")
        target_path = (self.root_path / clean_rel).resolve()
        
        # Security: Prevent Directory Traversal
        try:
            target_path.relative_to(self.root_path)
        except ValueError:
            raise PermissionError(f"Access denied: Path traversal detected outside sandbox for '{relative_path}'")
            
        return target_path

    async def execute(self, operation: str, resource: str, parameters: Dict[str, Any]) -> Any:
        if operation not in self.supported_operations:
            raise ValueError(f"Unsupported operation '{operation}' on tool '{self.name}'")

        safe_path = self._resolve_safe_path(resource)

        if operation == "read_file":
            if not safe_path.is_file():
                raise FileNotFoundError(f"File not found: {resource}")
            encoding = parameters.get("encoding", "utf-8")
            return {
                "resource": resource,
                "content": safe_path.read_text(encoding=encoding),
                "size_bytes": safe_path.stat().st_size
            }

        elif operation == "write_file":
            content = parameters.get("content", "")
            safe_path.parent.mkdir(parents=True, exist_ok=True)
            encoding = parameters.get("encoding", "utf-8")
            safe_path.write_text(content, encoding=encoding)
            return {
                "resource": resource,
                "status": "written",
                "bytes_written": len(content.encode(encoding)),
                "size_bytes": safe_path.stat().st_size
            }

        elif operation == "list_directory":
            if not safe_path.exists():
                raise FileNotFoundError(f"Directory not found: {resource}")
            if not safe_path.is_dir():
                raise NotADirectoryError(f"Resource is not a directory: {resource}")
                
            entries = []
            for item in safe_path.iterdir():
                entries.append({
                    "name": item.name,
                    "is_dir": item.is_dir(),
                    "size_bytes": item.stat().st_size if item.is_file() else 0
                })
            return {
                "directory": resource,
                "entries": entries
            }

        elif operation == "delete_file":
            if not safe_path.is_file():
                raise FileNotFoundError(f"File not found: {resource}")
            safe_path.unlink()
            return {
                "resource": resource,
                "status": "deleted"
            }
