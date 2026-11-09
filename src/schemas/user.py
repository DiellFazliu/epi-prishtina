"""
Pydantic schemas për Userat dhe Authentication.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator


# ═══ User Schemas ═══

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)
    age: Optional[int] = Field(None, ge=0, le=120)
    district: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)


class UserCreate(UserBase):
    """Schema për regjistrim."""
    password: str = Field(..., min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password-i duhet të ketë të paktën 8 karaktere")
        if not any(c.isupper() for c in v):
            raise ValueError("Password-i duhet të ketë të paktën një shkronjë të madhe")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password-i duhet të ketë të paktën një numër")
        return v


class UserUpdate(BaseModel):
    """Schema për përditësim."""
    full_name: Optional[str] = Field(None, max_length=255)
    age: Optional[int] = Field(None, ge=0, le=120)
    district: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)


class UserResponse(UserBase):
    """Schema për përgjigje."""
    id: UUID
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    """Schema për login."""
    username: str
    password: str


class Token(BaseModel):
    """Schema për token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenRefresh(BaseModel):
    """Schema për refresh token."""
    refresh_token: str


class PasswordChange(BaseModel):
    """Schema për ndryshim password."""
    old_password: str
    new_password: str = Field(..., min_length=8)