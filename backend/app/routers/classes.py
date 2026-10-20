from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.db import DBSession
from app.deps import current_academic_year, get_current_user, require_role
from app.models import Classroom, Subject, User
from app.schemas import ClassroomOut, StudentBrief, SubjectOut

router = APIRouter(tags=["classes"], dependencies=[Depends(get_current_user)])
staff_only = [Depends(require_role("faculty", "admin"))]


@router.get("/classes", response_model=list[ClassroomOut], dependencies=staff_only)
def list_classes(db: DBSession, year: int | None = Query(None, ge=2000, le=2100)):
    statement = (
        select(Classroom)
        .options(joinedload(Classroom.class_teacher))
        .where(Classroom.academic_year == (year or current_academic_year()))
        .order_by(Classroom.standard, Classroom.division)
    )
    return db.scalars(statement).all()


@router.get(
    "/classes/{class_id}/students", response_model=list[StudentBrief], dependencies=staff_only
)
def list_class_students(class_id: UUID, db: DBSession):
    if db.get(Classroom, class_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    statement = (
        select(User)
        .where(User.classroom_id == class_id, User.role == "student", User.is_active)
        .order_by(User.roll_no)
    )
    return db.scalars(statement).all()


@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects(db: DBSession):
    return db.scalars(select(Subject).order_by(Subject.code)).all()
