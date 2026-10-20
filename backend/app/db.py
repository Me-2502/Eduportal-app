from collections.abc import Generator
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import Connection, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_size=5,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)

# --- RLS identity -----------------------------------------------------------
# Policies read the current user from the `app.user_id` setting. It is set with
# is_local=true, so it only lives for one transaction and never leaks to the next
# request on a pooled connection. Because of that it has to be re-applied at the
# start of *every* transaction (e.g. after a db.commit()), which the listener does.


def _apply_rls_user(connection: Connection, user_id: str | None) -> None:
    connection.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": user_id or ""})


@event.listens_for(SessionLocal, "after_begin")
def _set_rls_user_on_begin(session: Session, transaction, connection: Connection) -> None:
    _apply_rls_user(connection, session.info.get("user_id"))


def set_rls_user(db: Session, user_id: UUID | None) -> None:
    """Run all following queries of this session as `user_id`."""
    db.info["user_id"] = str(user_id) if user_id else None
    if db.in_transaction():
        _apply_rls_user(db.connection(), db.info["user_id"])


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as db:
        yield db


DBSession = Annotated[Session, Depends(get_db)]
