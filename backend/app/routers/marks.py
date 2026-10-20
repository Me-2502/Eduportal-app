from decimal import Decimal
from itertools import groupby
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload

from app.db import DBSession
from app.deps import HodUser, StudentUser, get_current_user, require_role
from app.models import Mark, User
from app.schemas import Exam, MarkOut, MarksUpsertRequest, StandardMarksOut

router = APIRouter(prefix="/marks", tags=["marks"], dependencies=[Depends(get_current_user)])

Standard = Annotated[int, Path(ge=1, le=12)]
EXAM_ORDER = {"unit1": 1, "unit2": 2, "midterm": 3, "final": 4}


def _get_student(db: Session, student_id: UUID) -> User:
    student = db.get(User, student_id)
    if student is None or student.role != "student":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return student


def _load_marks(db: Session, student_id: UUID) -> list[Mark]:
    statement = (
        select(Mark)
        .options(joinedload(Mark.subject))
        .where(Mark.student_id == student_id)
        .order_by(Mark.standard, Mark.exam, Mark.subject_id)
    )
    return list(db.scalars(statement).all())


def _group_marks(marks: list[Mark]) -> list[StandardMarksOut]:
    # groupby only merges adjacent rows, which is why _load_marks sorts by (standard, exam)
    result = []
    for (standard, exam), group in groupby(marks, key=lambda m: (m.standard, m.exam)):
        rows = list(group)
        # sum as Decimal and convert at the end, float addition drifts
        total = sum((m.score for m in rows), Decimal(0))
        max_total = sum((m.max_score for m in rows), Decimal(0))
        result.append(
            StandardMarksOut(
                standard=standard,
                exam=exam,
                subjects=[MarkOut.model_validate(m) for m in rows],
                total=float(total),
                max_total=float(max_total),
                percentage=float((total / max_total * 100).quantize(Decimal("0.01"))),
            )
        )
    # SQL sorted exam alphabetically ("final" < "unit1"), display needs the real order
    result.sort(key=lambda r: (r.standard, EXAM_ORDER[r.exam]))
    return result


@router.get("/me", response_model=list[StandardMarksOut])
def my_marks(user: StudentUser, db: DBSession):
    return _group_marks(_load_marks(db, user.id))


@router.get(
    "/student/{student_id}",
    response_model=list[StandardMarksOut],
    dependencies=[Depends(require_role("faculty", "admin"))],
)
def student_marks(student_id: UUID, db: DBSession):
    _get_student(db, student_id)
    return _group_marks(_load_marks(db, student_id))


@router.put("/{student_id}/{standard}", status_code=status.HTTP_204_NO_CONTENT)
def save_marks(
    student_id: UUID, standard: Standard, body: MarksUpsertRequest, user: HodUser, db: DBSession
):
    """Insert or overwrite one student's marks for a standard/exam (idempotent)."""
    student = _get_student(db, student_id)
    if student.student_class is not None and standard > student.student_class.standard:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Student hasn't reached this standard yet"
        )

    rows = [
        {
            "student_id": student_id,
            "subject_id": entry.subject_id,
            "standard": standard,
            "exam": body.exam,
            "score": entry.score,
            "max_score": entry.max_score,
            "entered_by": user.id,  # RLS requires entered_by = current user
        }
        for entry in body.marks
    ]
    # INSERT ... ON CONFLICT DO UPDATE: one statement, no "select then insert or update" race.
    # `excluded` is the row that failed to insert.
    statement = insert(Mark).values(rows)
    statement = statement.on_conflict_do_update(
        constraint="marks_unique_entry_uq",
        set_={
            "score": statement.excluded.score,
            "max_score": statement.excluded.max_score,
            "entered_by": statement.excluded.entered_by,
        },
    )
    db.execute(statement)
    db.commit()


@router.delete("/{student_id}/{standard}", status_code=status.HTTP_204_NO_CONTENT)
def delete_marks(
    student_id: UUID, standard: Standard, user: HodUser, db: DBSession, exam: Exam = "final"
):
    result = db.execute(
        delete(Mark).where(
            Mark.student_id == student_id, Mark.standard == standard, Mark.exam == exam
        )
    )
    if result.rowcount == 0:  # nothing there, or RLS hid it
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No marks found")
    db.commit()
