from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_env: str = "dev"
    # App connection: a login role that is a member of eduportal_app (RLS applies)
    database_url: str
    # Owner connection: only for scripts/migrate.py and seeding (bypasses RLS)
    database_owner_url: str | None = None
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_seconds: int = 28800
    otp_expire_minutes: int = 10
    otp_max_attempts: int = 5
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
