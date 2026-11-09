"""
Test i shpejtë për authentication.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from src.db.base import SessionLocal, engine
from src.db.base import Base
from src.models import User, UserRole
from src.schemas.user import UserCreate, UserLogin
from src.services.auth_service import auth_service


ADMIN_USERNAME = os.environ["TEST_ADMIN_USERNAME"]
ADMIN_EMAIL = os.environ["TEST_ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["TEST_ADMIN_PASSWORD"]


def test_auth():
    """Test i plotë i authentication."""
    # Krijo tabelat
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # 1. Regjistro user
        print("\n1. Regjistrim useri...")
        user_data = UserCreate(
            email=ADMIN_EMAIL,
            username=ADMIN_USERNAME,
            full_name="Admin EpiPrishtina",
            password=ADMIN_PASSWORD,
            role="admin",
        )
        
        try:
            user = auth_service.register_user(db, user_data)
            print(f"   ✓ User u regjistrua: {user.username} ({user.role.value})")
        except Exception as e:
            print(f"   ! User mund të ekzistojë: {e}")
        
        # 2. Login
        print("\n2. Login...")
        login_data = UserLogin(
            username=ADMIN_USERNAME,
            password=ADMIN_PASSWORD,
        )
        user = auth_service.authenticate_user(db, login_data)
        print(f"   ✓ Login OK: {user.username}")
        
        # 3. Krijo tokens
        print("\n3. Krijim tokens...")
        tokens = auth_service.create_tokens(user)
        print(f"   ✓ Access token: {tokens['access_token'][:50]}...")
        print(f"   ✓ Refresh token: {tokens['refresh_token'][:50]}...")
        
        # 4. Verifiko token
        print("\n4. Verifikim token...")
        from src.core.security import decode_token
        payload = decode_token(tokens['access_token'])
        print(f"   ✓ Payload: {payload}")
        
        print("\n" + "="*60)
        print("  ✓ TË GJITHA TESTET KALUAN!")
        print("="*60 + "\n")
        
    finally:
        db.close()


if __name__ == "__main__":
    test_auth()
