import asyncio
import os
import sys

# Add the app directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.core.security import hash_password
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print("--- SEEDED USERS ---")
        for u in users:
            print(f"Email: {u.email}, Role ID: {u.role_id}")
            # Reset password to something known so the user can test
            u.hashed_password = hash_password("Password123!")
        
        await session.commit()
        print("--- ALL PASSWORDS RESET TO: Password123! ---")

if __name__ == "__main__":
    asyncio.run(run())
