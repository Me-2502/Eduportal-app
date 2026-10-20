from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session, contains_eager, joinedload

from app.db import DBSession
from app.deps import (
    FacultyUser,
    StaffUser,
    StudentUser,
    can_manage,
    get_current_user,
)
from app.models import Assignment, Submission, User
from app.schemas import (
    AssignmentCreate,
    AssignmentOut,
    AssignmentUpdate,
    GradeRequest,
    StudentAssignmentOut,
    SubmissionCreate,
    SubmissionOut,
)

router = APIRouter(
    prefix="/assignments", tags=["assignments"], dependencies=[Depends(get_current_user)]
)

ASSIGNMENT_OPTIONS = (joinedload(Assignment.subject), joinedload(Assignment.creator))


def _get_assignment(db: Session, assignment_id: UUID) -> Assignment:
    # RLS hides other classes' assignments from students, so "not yours" is also a 404 here
    assignment = db.get(Assignment, assignment_id, options=ASSIGNMENT_OPTIONS)
    if assignment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    return assignment


def _check_owner(assignment: Assignment, user: User) -> None:
    if assignment.created_by != user.id and not can_manage(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the creator, HOD or admin")


# --- Assignments ---
@router.get("", response_model=list[AssignmentOut])
def list_assignments(
    user: StaffUser,
    db: DBSession,
    classroom_id: UUID | None = None,
    subject_id: UUID | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Faculty: their own assignments by default, or filter by class / subject."""
    statement = select(Assignment).options(*ASSIGNMENT_OPTIONS)
    if classroom_id:
        statement = statement.where(Assignment.classroom_id == classroom_id)
    if subject_id:
        statement = statement.where(Assignment.subject_id == subject_id)
    if not classroom_id and not subject_id:
        statement = statement.where(Assignment.created_by == user.id)
    # a stable order (id as tie-breaker) is required for limit/offset pages to make sense
    statement = statement.order_by(Assignment.due_at.desc(), Assignment.id)
    return db.scalars(statement.limit(limit).offset(offset)).all()


@router.get("/me", response_model=list[StudentAssignmentOut])
def my_assignments(user: StudentUser, db: DBSession, pending: bool = False):
    statement = (
        select(Assignment, Submission)
        .options(*ASSIGNMENT_OPTIONS)
        # student_id goes in the ON clause: in WHERE it would drop the assignments without a
        # submission and quietly turn this into an INNER JOIN
        .outerjoin(
            Submission,
            and_(Submission.assignment_id == Assignment.id, Submission.student_id == user.id),
        )
        .where(Assignment.classroom_id == user.classroom_id)
        .order_by(Assignment.due_at, Assignment.id)
    )
    if pending:
        statement = statement.where(
            Submission.id.is_(None), or_(Assignment.due_at > func.now(), Assignment.allow_late)
        )
    return [
        StudentAssignmentOut(assignment=assignment, submission=submission)
        for assignment, submission in db.execute(statement).all()
    ]


@router.post("", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED)
def create_assignment(body: AssignmentCreate, user: FacultyUser, db: DBSession):
    # RLS (app_teaches) rejects classes/subjects this faculty doesn't teach -> 403 via main.py
    assignment = Assignment(**body.model_dump(), created_by=user.id)
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/{assignment_id}", response_model=AssignmentOut)
def get_assignment(assignment_id: UUID, db: DBSession):
    return _get_assignment(db, assignment_id)


@router.patch("/{assignment_id}", response_model=AssignmentOut)
def update_assignment(assignment_id: UUID, body: AssignmentUpdate, user: StaffUser, db: DBSession):
    assignment = _get_assignment(db, assignment_id)
    _check_owner(assignment, user)
    changes = body.model_dump(exclude_unset=True)

    # Moving the deadline into the past would silently close the assignment, so it's
    # rejected like on create. To close early, set due_at to a time in the near future.
    if "due_at" in changes and changes["due_at"] <= datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "due_at must be in the future")

    # Rules that depend on other rows can't live in the schema. One EXISTS query each,
    # without loading the submissions.
    if "max_score" in changes:
        new_max = changes["max_score"]
        graded = Submission.assignment_id == assignment_id
        if new_max is None:
            conflict = graded & Submission.score.is_not(None)
            message = "Some submissions are already graded, can't make this ungraded"
        else:
            conflict = graded & (Submission.score > new_max)
            message = "Some submissions already have a score above the new max_score"
        if db.scalar(select(exists().where(conflict))):
            raise HTTPException(status.HTTP_409_CONFLICT, message)

    for field, value in changes.items():
        setattr(assignment, field, value)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(assignment_id: UUID, user: StaffUser, db: DBSession):
    assignment = _get_assignment(db, assignment_id)
    _check_owner(assignment, user)
    # submissions reference it with ON DELETE RESTRICT -> 409 via the handler in main.py
    db.delete(assignment)
    db.commit()


# --- Submissions ---
@router.get("/{assignment_id}/submissions", response_model=list[SubmissionOut])
def list_submissions(assignment_id: UUID, user: StaffUser, db: DBSession):
    _check_owner(_get_assignment(db, assignment_id), user)
    statement = (
        select(Submission)
        # join to sort by roll_no, and contains_eager reuses that same join to fill
        # Submission.student, so no second join or query
        .join(Submission.student)
        .options(contains_eager(Submission.student))
        .where(Submission.assignment_id == assignment_id)
        .order_by(User.roll_no)
    )
    return db.scalars(statement).all()


@router.put("/{assignment_id}/submission", response_model=SubmissionOut)
def submit(assignment_id: UUID, body: SubmissionCreate, user: StudentUser, db: DBSession):
    """Submit, or resubmit by replacing the file. Deadline / late rules live in the trigger."""
    assignment = _get_assignment(db, assignment_id)
    if assignment.classroom_id != user.classroom_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")

    submission = db.scalar(
        select(Submission).where(
            Submission.assignment_id == assignment_id, Submission.student_id == user.id
        )
    )
    if submission is None:
        submission = Submission(
            assignment_id=assignment_id, student_id=user.id, **body.model_dump()
        )
        db.add(submission)
    else:
        if submission.graded_at is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Already graded, can't resubmit")
        for field, value in body.model_dump().items():
            setattr(submission, field, value)
        # forces an UPDATE even if the metadata is identical, so the trigger re-stamps the time
        submission.submitted_at = func.now()

    db.commit()
    db.refresh(submission)  # submitted_at / is_late were set by the trigger
    return submission


@router.delete("/{assignment_id}/submission", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_submission(assignment_id: UUID, user: StudentUser, db: DBSession):
    submission = db.scalar(
        select(Submission).where(
            Submission.assignment_id == assignment_id, Submission.student_id == user.id
        )
    )
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No submission found")
    if submission.graded_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already graded, can't withdraw")
    db.delete(submission)
    db.commit()


@router.patch("/{assignment_id}/submissions/{submission_id}/grade", response_model=SubmissionOut)
def grade_submission(
    assignment_id: UUID,
    submission_id: UUID,
    body: GradeRequest,
    user: StaffUser,
    db: DBSession,
):
    submission = db.get(Submission, submission_id)
    if submission is None or submission.assignment_id != assignment_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    _check_owner(submission.assignment, user)
    if submission.assignment.max_score is None and body.score is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "This assignment is ungraded")

    # score > max_score is checked by the trigger (-> 422); graded_by/graded_at too
    submission.score = body.score
    submission.feedback = body.feedback
    db.commit()
    db.refresh(submission)
    return submission
