from datetime import date, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload

from app.db import DBSession
from app.deps import CurrentUser, ManagerUser, current_academic_year, get_current_user
from app.models import Attendance, Classroom, User
from app.schemas import (
    AbsenceEntry,
    AbsenceOut,
    AbsenceWithUserOut,
    AttendanceMonthOut,
    DayAttendanceRequest,
)

router = APIRouter(
    prefix="/attendance", tags=["attendance"], dependencies=[Depends(get_current_user)]
)

MAX_RANGE = timedelta(days=366)


def _date_range(from_: date | None, to: date | None) -> tuple[date, date]:
    end = to or date.today()
    start = from_ or end - timedelta(days=30)
    if start > end or end - start > MAX_RANGE:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "'from' must be before 'to', max 366 days"
        )
    return start, end


def _check_day(day: date) -> None:
    if day > date.today():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Date cannot be in the future")


def _get_class_for(db: Session, class_id: UUID, user: User, *, allow_hod: bool) -> Classroom:
    classroom = db.get(Classroom, class_id)
    if classroom is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    allowed = (
        classroom.class_teacher_id == user.id or user.role == "admin" or (allow_hod and user.is_hod)
    )
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the class teacher can do this")
    return classroom


def _sync_absences(
    db: Session,
    day: date,
    entries: list[AbsenceEntry],
    allowed_ids: set[UUID],
    class_id: UUID | None,
    marked_by: UUID,
) -> None:
    """Make the absent list for `day` (within allowed_ids) exactly `entries`."""
    absent_ids = {entry.user_id for entry in entries}
    if absent_ids - allowed_ids:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Some users can't be marked in this list"
        )

    # people marked absent earlier but present now
    present_ids = allowed_ids - absent_ids
    if present_ids:
        db.execute(
            delete(Attendance).where(
                Attendance.absent_on == day, Attendance.user_id.in_(present_ids)
            )
        )

    if entries:
        statement = insert(Attendance).values(
            [
                {
                    "user_id": entry.user_id,
                    "class_id": class_id,
                    "absent_on": day,
                    "reason": entry.reason,
                    "is_excused": entry.is_excused,
                    "marked_by": marked_by,  # the trigger overwrites it with the RLS user anyway
                }
                for entry in entries
            ]
        )
        statement = statement.on_conflict_do_update(
            constraint="attendance_user_day_uq",
            set_={"reason": statement.excluded.reason, "is_excused": statement.excluded.is_excused},
        )
        db.execute(statement)


@router.get("/me", response_model=list[AbsenceOut])
def my_absences(
    user: CurrentUser,
    db: DBSession,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
):
    statement = select(Attendance).where(Attendance.user_id == user.id)
    if from_:
        statement = statement.where(Attendance.absent_on >= from_)
    if to:
        statement = statement.where(Attendance.absent_on <= to)
    return db.scalars(statement.order_by(Attendance.absent_on.desc())).all()


@router.get("/me/summary", response_model=list[AttendanceMonthOut])
def my_attendance_summary(
    user: CurrentUser, db: DBSession, year: int | None = Query(None, ge=2000, le=2100)
):
    year = year or current_academic_year()
    start, end = date(year, 6, 1), date(year + 1, 5, 31)

    # let the database count: COUNT(*) FILTER gives both counts in one pass
    month = func.date_trunc("month", Attendance.absent_on).label("month")
    statement = (
        select(
            month,
            func.count().label("absent_days"),
            func.count().filter(Attendance.is_excused).label("excused_days"),
        )
        .where(Attendance.user_id == user.id, Attendance.absent_on.between(start, end))
        .group_by(month)
        .order_by(month)
    )
    # months with no absences are left out; the frontend fills the gaps
    return [
        AttendanceMonthOut(
            month=row.month.date(), absent_days=row.absent_days, excused_days=row.excused_days
        )
        for row in db.execute(statement).all()
    ]


@router.get("/class/{class_id}", response_model=list[AbsenceWithUserOut])
def class_absences(
    class_id: UUID,
    user: CurrentUser,
    db: DBSession,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
):
    _get_class_for(db, class_id, user, allow_hod=True)
    start, end = _date_range(from_, to)
    statement = (
        select(Attendance)
        .options(joinedload(Attendance.user))
        .where(Attendance.class_id == class_id, Attendance.absent_on.between(start, end))
        .order_by(Attendance.absent_on.desc())
    )
    return db.scalars(statement).all()


@router.put("/class/{class_id}/{day}", status_code=status.HTTP_204_NO_CONTENT)
def set_class_attendance(
    class_id: UUID, day: date, body: DayAttendanceRequest, user: CurrentUser, db: DBSession
):
    """Class teacher submits the absentees for a day. Students not listed are present."""
    _get_class_for(db, class_id, user, allow_hod=False)
    _check_day(day)
    student_ids = set(
        db.scalars(
            select(User.id).where(User.classroom_id == class_id, User.role == "student")
        ).all()
    )
    _sync_absences(db, day, body.absentees, student_ids, class_id, user.id)
    db.commit()


@router.get("/faculty", response_model=list[AbsenceWithUserOut])
def faculty_absences(
    user: ManagerUser,
    db: DBSession,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
):
    start, end = _date_range(from_, to)
    statement = (
        select(Attendance)
        .options(joinedload(Attendance.user))
        .where(Attendance.class_id.is_(None), Attendance.absent_on.between(start, end))
        .order_by(Attendance.absent_on.desc())
    )
    return db.scalars(statement).all()


@router.put("/faculty/{day}", status_code=status.HTTP_204_NO_CONTENT)
def set_faculty_attendance(day: date, body: DayAttendanceRequest, user: ManagerUser, db: DBSession):
    """HOD submits the absent faculty for a day. A HOD can't mark themselves."""
    _check_day(day)
    statement = select(User.id).where(User.role == "faculty", User.is_active)
    if user.role != "admin":
        statement = statement.where(User.id != user.id)
    faculty_ids = set(db.scalars(statement).all())
    _sync_absences(db, day, body.absentees, faculty_ids, None, user.id)
    db.commit()
