"""
Auth Service — logjika e biznesit për authentication.
"""

from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from src.models.user import User, UserRole
from src.schemas.user import UserCreate, UserLogin
from src.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from src.core.config import settings


class AuthService:
    """Shërbimi për authentication dhe user management."""

    @staticmethod
    def register_user(db: Session, user_data: UserCreate) -> User:
        """Regjistro një user të re."""
        # Kontrollo nëse email/username ekziston
        existing_email = db.query(User).filter(User.email == user_data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email-i është i regjistruar",
            )

        existing_username = db.query(User).filter(User.username == user_data.username).first()
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username-i është i zënë",
            )

        # Public registration always creates citizen accounts.
        role = UserRole.CITIZEN

        # Krijo userin
        user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=hash_password(user_data.password),
            role=role,
            age=user_data.age,
            district=user_data.district,
            phone=user_data.phone,
            is_active=True,
            is_verified=False,
        )

        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def authenticate_user(db: Session, login_data: UserLogin) -> User:
        """Autentifiko një user."""
        # Gjej userin
        user = db.query(User).filter(User.username == login_data.username).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username ose password i gabuar",
            )

        # Verifiko password
        if not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username ose password i gabuar",
            )

        # Verifiko aktiv
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Useri është i çaktivizuar",
            )

        # Përditëso last_login
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)

        return user

    @staticmethod
    def create_tokens(user: User) -> dict:
        """Krijo access dhe refresh tokens."""
        access_token = create_access_token(
            subject=str(user.id),
            additional_claims={
                "username": user.username,
                "role": user.role.value,
            },
        )
        refresh_token = create_refresh_token(subject=str(user.id))

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    @staticmethod
    def refresh_access_token(db: Session, refresh_token: str) -> dict:
        """Rifresko access token nga refresh token."""
        payload = decode_token(refresh_token)

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Lloj token i pavlefshëm",
            )

        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Useri nuk ekziston ose është i çaktivizuar",
            )

        return AuthService.create_tokens(user)

    @staticmethod
    def change_password(
        db: Session,
        user: User,
        old_password: str,
        new_password: str,
    ) -> None:
        """Ndrysho password."""
        if not verify_password(old_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-i aktual është i gabuar",
            )

        user.hashed_password = hash_password(new_password)
        db.commit()


auth_service = AuthService()