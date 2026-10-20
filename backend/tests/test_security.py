from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas import ResetPasswordRequest
from app.security import (
    create_access_token,
    decode_access_token,
    generate_otp,
    hash_otp,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("s3cret-pass")
    assert verify_password("s3cret-pass", hashed)
    assert not verify_password("wrong-pass", hashed)
    assert not verify_password("s3cret-pass", "not-a-bcrypt-hash")


def test_jwt_roundtrip_and_tamper():
    user_id = uuid4()
    token = create_access_token(user_id, "student")
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "student"
    assert decode_access_token(token[:-2] + "xx") is None


def test_otp_format_and_hash():
    otp = generate_otp()
    assert len(otp) == 6 and otp.isdigit()
    assert len(hash_otp(otp)) == 64  # matches the DB CHECK
    assert hash_otp(otp) == hash_otp(otp)


@pytest.mark.parametrize(
    "otp,password",
    [("12345", "longenough"), ("abcdef", "longenough"), ("123456", "short"), ("123456", "é" * 40)],
)
def test_reset_request_validation(otp, password):
    with pytest.raises(ValidationError):
        ResetPasswordRequest(username="2026A01", otp=otp, new_password=password)
