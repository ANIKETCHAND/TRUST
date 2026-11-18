import os
import sys
from urllib.parse import parse_qs, urlencode

# Ensure backend directory is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", "backend"))

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import the FastAPI application
from app.main import app as fastapi_app


class VercelPathMiddleware:
    """
    Middleware for Vercel Serverless environment.
    Recovers the true request URI passed via `_url` rewrite query parameter,
    restoring standard ASGI scope['path'] and scope['query_string'] before
    FastAPI router dispatch.
    """
    def __init__(self, asgi_app):
        self.app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            query_str = scope.get("query_string", b"").decode("latin1")
            
            if "_url=" in query_str:
                parsed = parse_qs(query_str, keep_blank_values=True)
                if "_url" in parsed and parsed["_url"]:
                    target_url = parsed["_url"][0]
                    del parsed["_url"]
                    
                    if "?" in target_url:
                        path_part, extra_query = target_url.split("?", 1)
                        scope["path"] = path_part
                    else:
                        scope["path"] = target_url
                        
                    pairs = []
                    for k, vals in parsed.items():
                        for v in vals:
                            pairs.append((k, v))
                    scope["query_string"] = urlencode(pairs).encode("latin1")
            elif scope.get("path") in ("/api/index.py", "/api/index"):
                scope["path"] = "/api/health"

        await self.app(scope, receive, send)


app = VercelPathMiddleware(fastapi_app)

__all__ = ["app"]
