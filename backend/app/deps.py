from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db import DBSession, set_rls_user
from app.models import User
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    db: DBSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    payload = decode_access_token(credentials.credentials)
    try:
        user_id = UUID(payload["sub"])
    except (TypeError, KeyError, ValueError):
        raise unauthorized from None

    # From here on every query in this request runs as this user under RLS
    set_rls_user(db, user_id)
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: str):
    def dependency(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
        return user

    return dependency


def require_hod(user: CurrentUser) -> User:
    if not user.is_hod:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HOD is allowed")
    return user


def can_manage(user: User) -> bool:
    """HOD and admin may edit records that other people created."""
    return user.is_hod or user.role == "admin"


def require_manager(user: CurrentUser) -> User:
    if not can_manage(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HOD or admin")
    return user


StudentUser = Annotated[User, Depends(require_role("student"))]
FacultyUser = Annotated[User, Depends(require_role("faculty"))]
StaffUser = Annotated[User, Depends(require_role("faculty", "admin"))]
HodUser = Annotated[User, Depends(require_hod)]
ManagerUser = Annotated[User, Depends(require_manager)]


def current_academic_year(today: date | None = None) -> int:
    today = today or date.today()
    return today.year if today.month >= 6 else today.year - 1
