import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def test():
    print("Inspecting batches table columns...")
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'batches'")
        )
        for row in res.fetchall():
            print(f"Column: {row[0]}, Type: {row[1]}")

if __name__ == '__main__':
    asyncio.run(test())
