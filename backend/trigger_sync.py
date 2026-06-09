import httpx
import asyncio

async def run():
    async with httpx.AsyncClient() as client:
        # We trigger the middleware for the testfarm tenant
        resp = await client.get("http://localhost:8000/api/v1/settings/public", headers={"Host": "testfarm.localhost:8000"})
        print(f"Status Code: {resp.status_code}")
        print(f"Response: {resp.text}")

if __name__ == "__main__":
    asyncio.run(run())
