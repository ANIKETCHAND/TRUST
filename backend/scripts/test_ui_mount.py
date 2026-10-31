import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from httpx import ASGITransport, AsyncClient
from app.main import app


async def test_ui_mount():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        resp = await client.get("/")
        print("Root UI Status:", resp.status_code)
        print("Served Content Snippet:", resp.text[:150])
        assert resp.status_code == 200
        assert "<div id=\"root\"></div>" in resp.text
        print("Frontend UI correctly compiled and mounted at root '/'!")


if __name__ == "__main__":
    asyncio.run(test_ui_mount())
