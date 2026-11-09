"""
User endpoints — menaxhim i userave (admin).
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.db.base import get_db
from src.models import AuditLog
from src.models.user import User, UserRole
from src.schemas.user import UserResponse, UserUpdate
from src.core.security import require_admin, get_current_user


router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/audit-log",
    summary="Historiku i veprimeve administrative",
)
async def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Kthen veprimet kritike të regjistruara, vetëm për admin."""
    rows = db.query(AuditLog).order_by(
        AuditLog.created_at.desc()
    ).limit(limit).all()
    return [
        {
            "id": str(row.id),
            "user_id": str(row.user_id) if row.user_id else None,
            "action": row.action,
            "resource_type": row.resource_type,
            "resource_id": row.resource_id,
            "details": row.details,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.get(
    "",
    response_model=List[UserResponse],
    summary="Lista e userave (admin)",
)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Lista e të gjithë userave (vetëm admin)."""
    query = db.query(User)

    if role:
        query = query.filter(User.role == UserRole(role))
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    return query.offset(skip).limit(limit).all()


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Merr një user",
)
async def get_user(
    user_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Merr detajet e një useri."""
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nuk kesh të drejtë të shohësh këtë user",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Useri nuk u gjet",
        )
    return user


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Përditëso user (admin ose vet)",
)
async def update_user(
    user_id: UUID,
    update_data: UserUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Përditëso një user."""
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nuk kesh të drejtë të përditësosh këtë user",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Useri nuk u gjet",
        )

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Fshi user (admin)",
)
async def delete_user(
    user_id: UUID,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Fshi një user (vetëm admin)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Useri nuk u gjet",
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nuk mund të fshish veten",
        )

    db.delete(user)
    db.commit()