"""
Auth endpoints — register, login, refresh, me.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from src.db.base import get_db
from src.schemas.user import (
    UserCreate,
    UserResponse,
    UserLogin,
    Token,
    TokenRefresh,
    PasswordChange,
)
from src.services.auth_service import auth_service
from src.core.security import get_current_user


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Regjistro një user të re",
)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    """
    Regjistro një user të re me:
    - Email
    - Username
    - Password (min 8 karaktere, 1 shkronjë të madhe, 1 numër)
    """
    user = auth_service.register_user(db, user_data)
    return user


@router.post(
    "/login",
    response_model=Token,
    summary="Login me username/password",
)
async def login(
    login_data: UserLogin,
    db: Session = Depends(get_db),
):
    """Login dhe merr access + refresh tokens."""
    user = auth_service.authenticate_user(db, login_data)
    tokens = auth_service.create_tokens(user)
    return tokens


@router.post(
    "/login/form",
    response_model=Token,
    summary="Login me form (për Swagger UI)",
)
async def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Login përmes OAuth2 form (për Swagger UI)."""
    login_data = UserLogin(
        username=form_data.username,
        password=form_data.password,
    )
    user = auth_service.authenticate_user(db, login_data)
    tokens = auth_service.create_tokens(user)
    return tokens


@router.post(
    "/refresh",
    response_model=Token,
    summary="Rifresko access token",
)
async def refresh_token(
    data: TokenRefresh,
    db: Session = Depends(get_db),
):
    """Rifresko access token me refresh token."""
    return auth_service.refresh_access_token(db, data.refresh_token)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Merr userin aktual",
)
async def get_me(current_user=Depends(get_current_user)):
    """Kthen informacionin e userit aktual."""
    return current_user


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Ndrysho password",
)
async def change_password(
    data: PasswordChange,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ndrysho password-in e userit aktual."""
    auth_service.change_password(
        db,
        current_user,
        data.old_password,
        data.new_password,
    )
    return {"message": "Password-i u ndryshua me sukses"}