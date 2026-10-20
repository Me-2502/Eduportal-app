from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)


def _bcrypt_limit(value: str) -> str:
    # bcrypt only accepts up to 72 *bytes* (non-ASCII chars take more than one)
    if len(value.encode()) > 72:
        raise ValueError("Password is too long")
    return value


Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=50)]
# New passwords: policy applies. Passwords are never stripped.
NewPassword = Annotated[
    str, StringConstraints(min_length=8, max_length=72), AfterValidator(_bcrypt_limit)
]
# Existing passwords: only a sanity limit, the policy may have changed since they were set
AnyPassword = Annotated[str, StringConstraints(min_length=1, max_length=72)]
Otp = Annotated[str, StringConstraints(pattern=r"^\d{6}$")]


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- Auth requests ---
class LoginRequest(RequestModel):
    username: Username
    password: AnyPassword


class ChangePasswordRequest(RequestModel):
    old_password: AnyPassword
    new_password: NewPassword


class ForgotPasswordRequest(RequestModel):
    username: Username


class ResetPasswordRequest(RequestModel):
    username: Username
    otp: Otp
    new_password: NewPassword


# --- Auth responses ---
class UserOut(BaseModel):
    """Public user profile."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    role: str
    first_name: str
    last_name: str
    gender: str | None
    email: str | None
    must_change_password: bool
    classroom_id: UUID | None
    roll_no: int | None
    is_hod: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MessageResponse(BaseModel):
    detail: str


class SubjectBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    name: str


class PersonBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    first_name: str
    last_name: str


class ClassroomBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    standard: int
    division: str
    room_no: int


class TimetableSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    day_of_week: int
    period: int
    academic_year: int
    subject: SubjectBrief
    faculty: PersonBrief
    classroom: ClassroomBrief


# --- Shared field types ---
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
Score = Annotated[Decimal, Field(ge=0, max_digits=5, decimal_places=2)]
MaxScore = Annotated[Decimal, Field(gt=0, max_digits=5, decimal_places=2)]
Exam = Literal["unit1", "unit2", "midterm", "final"]
EventType = Literal["event", "holiday", "exam", "meeting", "other"]


def _reject_nulls(model: BaseModel, *fields: str) -> None:
    """PATCH bodies: a field may be left out, but NOT NULL columns can't be sent as null."""
    for field in fields:
        if field in model.model_fields_set and getattr(model, field) is None:
            raise ValueError(f"{field} cannot be null")


# --- People / classes ---
class StudentBrief(PersonBrief):
    roll_no: int | None
    gender: str | None


class FacultyOut(PersonBrief):
    gender: str | None
    is_hod: bool
    subjects: list[SubjectBrief]


class SubjectOut(SubjectBrief):
    id: UUID


class ClassroomOut(ClassroomBrief):
    academic_year: int
    class_teacher: PersonBrief | None


# --- Marks ---
# Scores are Decimal in the DB; float in responses so JSON gets numbers instead of strings
class MarkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    subject: SubjectBrief
    score: float
    max_score: float


class StandardMarksOut(BaseModel):
    standard: int
    exam: str
    subjects: list[MarkOut]
    total: float
    max_total: float
    percentage: float


class MarkEntry(RequestModel):
    subject_id: UUID
    score: Score
    max_score: MaxScore = Decimal("100")

    @model_validator(mode="after")
    def _score_within_max(self):
        if self.score > self.max_score:
            raise ValueError("score cannot exceed max_score")
        return self


class MarksUpsertRequest(RequestModel):
    exam: Exam = "final"
    marks: list[MarkEntry] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def _unique_subjects(self):
        subject_ids = [entry.subject_id for entry in self.marks]
        if len(subject_ids) != len(set(subject_ids)):
            raise ValueError("Each subject may appear only once")
        return self


# --- Events ---
class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    description: str | None
    type: str
    starts_at: datetime
    ends_at: datetime | None
    creator: PersonBrief | None


class EventCreate(RequestModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: Annotated[str, StringConstraints(max_length=2000)] | None = None
    type: EventType = "event"
    starts_at: AwareDatetime
    ends_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def _ends_after_start(self):
        if self.ends_at is not None and self.ends_at < self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class EventUpdate(RequestModel):
    title: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
        | None
    ) = None
    description: Annotated[str, StringConstraints(max_length=2000)] | None = None
    type: EventType | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def _no_null_required(self):
        _reject_nulls(self, "title", "type", "starts_at")
        return self


# --- Attendance ---
class AbsenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    absent_on: date
    reason: str | None
    is_excused: bool


class AbsenceWithUserOut(AbsenceOut):
    user: StudentBrief


class AbsenceEntry(RequestModel):
    user_id: UUID
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)] | None = None
    is_excused: bool = False


class DayAttendanceRequest(RequestModel):
    """The full list of absentees for one day; everyone not listed is present."""

    absentees: list[AbsenceEntry] = Field(default_factory=list, max_length=200)

    @model_validator(mode="after")
    def _unique_users(self):
        user_ids = [entry.user_id for entry in self.absentees]
        if len(user_ids) != len(set(user_ids)):
            raise ValueError("Each user may appear only once")
        return self


class AttendanceMonthOut(BaseModel):
    month: date  # first day of the month
    absent_days: int
    excused_days: int


# --- Assignments / submissions ---
class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    classroom_id: UUID
    subject: SubjectBrief
    creator: PersonBrief
    title: str
    description: str | None
    due_at: datetime
    max_score: float | None
    allow_late: bool
    created_at: datetime


class AssignmentCreate(RequestModel):
    classroom_id: UUID
    subject_id: UUID
    title: Title
    description: Annotated[str, StringConstraints(max_length=5000)] | None = None
    due_at: AwareDatetime
    max_score: MaxScore | None = None  # None = ungraded
    allow_late: bool = False

    @model_validator(mode="after")
    def _due_in_future(self):
        if self.due_at <= datetime.now(timezone.utc):
            raise ValueError("due_at must be in the future")
        return self


class AssignmentUpdate(RequestModel):
    title: Title | None = None
    description: Annotated[str, StringConstraints(max_length=5000)] | None = None
    due_at: AwareDatetime | None = None
    max_score: MaxScore | None = None
    allow_late: bool | None = None

    @model_validator(mode="after")
    def _no_null_required(self):
        _reject_nulls(self, "title", "due_at", "allow_late")
        return self


class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    assignment_id: UUID
    student: StudentBrief
    file_name: str | None
    content_type: str | None
    file_size_bytes: int | None
    submitted_at: datetime
    is_late: bool
    score: float | None
    feedback: str | None
    graded_at: datetime | None


class StudentAssignmentOut(BaseModel):
    assignment: AssignmentOut
    submission: SubmissionOut | None


class SubmissionCreate(RequestModel):
    # Until file storage exists the client sends the metadata. Later the upload endpoint
    # will produce file_path itself, and clients must never choose storage paths.
    file_path: Annotated[str, StringConstraints(min_length=1, max_length=500)]
    file_name: Annotated[str, StringConstraints(max_length=255)] | None = None
    content_type: Annotated[str, StringConstraints(max_length=100)] | None = None
    file_size_bytes: int | None = Field(None, gt=0, le=25 * 1024 * 1024)


class GradeRequest(RequestModel):
    score: Score | None
    feedback: Annotated[str, StringConstraints(max_length=2000)] | None = None
