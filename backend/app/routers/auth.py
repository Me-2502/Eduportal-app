import ipaddress
import logging

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import text

from app.config import settings
from app.db import DBSession, set_rls_user
from app.deps import CurrentUser
from app.ratelimit import limiter
from app.models import User
from app.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
)
from app.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    generate_otp,
    hash_otp,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(body: LoginRequest, request: Request, db: DBSession):
    # Before login RLS hides every user, so the hash comes from a SECURITY DEFINER function
    row = (
        db.execute(text("SELECT * FROM app_login_lookup(:username)"), {"username": body.username})
        .mappings()
        .first()
    )

    password_ok = verify_password(
        body.password, row["password_hash"] if row else DUMMY_PASSWORD_HASH
    )
    if row is None or not password_ok or not row["is_active"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    set_rls_user(db, row["id"])
    user = db.get(User, row["id"])
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def change_password(body: ChangePasswordRequest, request: Request, user: CurrentUser, db: DBSession):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Old password is incorrect")
    if body.new_password == body.old_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must be different")

    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    db.commit()


@router.post(
    "/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED
)
@limiter.limit("5/minute")
def forgot_password(body: ForgotPasswordRequest, request: Request, db: DBSession):
    otp = generate_otp()
    row = (
        db.execute(
            text(
                "SELECT * FROM app_request_password_reset("
                ":username, :otp_hash, :ttl, CAST(:ip AS inet))"
            ),
            {
                "username": body.username,
                "otp_hash": hash_otp(otp),
                "ttl": settings.otp_expire_minutes,
                "ip": _client_ip(request),
            },
        )
        .mappings()
        .first()
    )
    db.commit()

    if row:
        _send_otp_email(row["email"], row["first_name"], otp)
    return MessageResponse(detail="If the account exists, an OTP has been sent to its email.")


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def reset_password(body: ResetPasswordRequest, request: Request, db: DBSession):
    result = db.execute(
        text("SELECT app_reset_password(:username, :otp_hash, :password_hash, :max_attempts)"),
        {
            "username": body.username,
            "otp_hash": hash_otp(body.otp),
            "password_hash": hash_password(body.new_password),
            "max_attempts": settings.otp_max_attempts,
        },
    ).scalar_one()
    db.commit()  # commit even on failure so the attempt counter is saved

    errors = {
        "invalid": (status.HTTP_400_BAD_REQUEST, "Invalid OTP"),
        "expired": (status.HTTP_400_BAD_REQUEST, "OTP has expired, request a new one"),
        "too_many_attempts": (
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many attempts, request a new OTP",
        ),
    }
    if result in errors:
        raise HTTPException(*errors[result])


def _client_ip(request: Request) -> str | None:
    host = request.client.host if request.client else None
    try:
        return str(ipaddress.ip_address(host)) if host else None
    except ValueError:  # e.g. "testclient"
        return None


def _send_otp_email(email: str, first_name: str, otp: str) -> None:
    if settings.app_env == "dev":
        logger.warning("DEV ONLY - OTP for %s <%s>: %s", first_name, email, otp)
