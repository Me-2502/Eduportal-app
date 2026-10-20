from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import AwareDatetime
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.db import DBSession
from app.deps import CurrentUser, StaffUser, can_manage, get_current_user
from app.models import Event, User
from app.schemas import EventCreate, EventOut, EventUpdate

router = APIRouter(prefix="/events", tags=["events"], dependencies=[Depends(get_current_user)])

MAX_RANGE = timedelta(days=366)


@router.get("", response_model=list[EventOut])
def list_events(
    db: DBSession,
    from_: Annotated[AwareDatetime | None, Query(alias="from")] = None,
    to: AwareDatetime | None = None,
):
    start = from_ or datetime.now(timezone.utc)
    end = to or start + timedelta(days=31)
    if end <= start or end - start > MAX_RANGE:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "'to' must be after 'from', max 366 days"
        )

    statement = (
        select(Event)
        .options(joinedload(Event.creator))
        # overlap, not containment: a 3-day trip starting yesterday still shows up today
        .where(Event.starts_at < end, func.coalesce(Event.ends_at, Event.starts_at) >= start)
        .order_by(Event.starts_at, Event.id)
    )
    return db.scalars(statement).all()


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(body: EventCreate, user: StaffUser, db: DBSession):
    event = Event(**body.model_dump(), created_by=user.id)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def _get_editable_event(db: Session, event_id: UUID, user: User) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    # RLS would block the write too, but an ORM UPDATE that matches 0 rows raises
    # StaleDataError (a 500). Checking here gives the client a real 403.
    if event.created_by != user.id and not can_manage(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the creator, HOD or admin")
    return event


@router.patch("/{event_id}", response_model=EventOut)
def update_event(event_id: UUID, body: EventUpdate, user: CurrentUser, db: DBSession):
    event = _get_editable_event(db, event_id, user)

    # exclude_unset: only fields the client actually sent, so "description": null clears it
    # but leaving description out keeps it
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(event, field, value)

    # validated after merging, because the client may send only one of the two
    if event.ends_at is not None and event.ends_at < event.starts_at:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "ends_at must be after starts_at")

    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: UUID, user: CurrentUser, db: DBSession):
    db.delete(_get_editable_event(db, event_id, user))
    db.commit()
