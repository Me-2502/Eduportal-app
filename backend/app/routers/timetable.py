from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.db import DBSession
from app.deps import CurrentUser, current_academic_year, get_current_user, require_role
from app.models import TimetableSlot
from app.schemas import TimetableSlotOut

router = APIRouter(
    prefix="/timetable", tags=["timetable"], dependencies=[Depends(get_current_user)]
)


@router.get("/me", response_model=list[TimetableSlotOut])
def get_my_timetable(
    user: CurrentUser, db: DBSession, year: int | None = Query(None, ge=2000, le=2100)
):
    statement = (
        select(TimetableSlot)
        .options(
            joinedload(TimetableSlot.subject),
            joinedload(TimetableSlot.faculty),
            joinedload(TimetableSlot.classroom),
        )
        .order_by(TimetableSlot.day_of_week, TimetableSlot.period)
    )

    if user.role == "student":
        if user.classroom_id is None:
            return []
        statement = statement.where(TimetableSlot.classroom_id == user.classroom_id)
    elif user.role == "faculty":
        statement = statement.where(
            TimetableSlot.faculty_id == user.id,
            TimetableSlot.academic_year == (year or current_academic_year()),
        )
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No timetable for this role")

    return db.scalars(statement).all()


@router.get(
    "/class/{class_id}",
    response_model=list[TimetableSlotOut],
    dependencies=[Depends(require_role("faculty", "admin"))],
)
def get_class_timetable(
    class_id: UUID, db: DBSession, year: int | None = Query(None, ge=2000, le=2100)
):
    statement = (
        select(TimetableSlot)
        .options(
            joinedload(TimetableSlot.subject),
            joinedload(TimetableSlot.faculty),
            joinedload(TimetableSlot.classroom),
        )
        .where(
            TimetableSlot.classroom_id == class_id,
            TimetableSlot.academic_year == (year or current_academic_year()),
        )
        .order_by(TimetableSlot.day_of_week, TimetableSlot.period)
    )

    return db.scalars(statement).all()
