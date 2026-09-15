import re
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator


class GenderCategory(str, Enum):
    female = "female"
    male = "male"
    unspecified = "unspecified"


class AdminLogin(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class RecordingFields(BaseModel):
    recording_id: str = Field(min_length=8, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    participant_id: str = Field(min_length=2, max_length=4)
    age_group: str = Field(min_length=1, max_length=30)
    gender_category: GenderCategory
    native_language: str = Field(min_length=1, max_length=60)
    environment: str = Field(pattern=r"^E[1-6]$")
    phrase_id: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    phrase_text: str = Field(min_length=1, max_length=500)
    translation: str = Field(min_length=1, max_length=500)
    category: str = Field(min_length=1, max_length=30)
    section_class: str = Field(pattern=r"^[DAN]$")
    take_code: str = Field(pattern=r"^R\d{2}$")
    intensity: str = Field(default="", max_length=40)
    loudness: str = Field(default="", max_length=20)
    environment_name: str = Field(default="", max_length=60)
    content_gender: str = Field(default="female", pattern=r"^(female|male)$")
    recording_number: int = Field(ge=1, le=30)
    consent: bool
    mime_type: str = Field(default="audio/webm", max_length=100)

    @field_validator("participant_id")
    @classmethod
    def clean_participant_id(cls, value: str) -> str:
        value = value.strip().upper()
        match = re.fullmatch(r"([FMU])(\d{2,3})", value)
        if not match:
            raise ValueError("Participant ID must use F01-F75, M01-M20, or U01-U99.")
        prefix, number = match.groups()
        number_value = int(number)
        if prefix == "M" and not 1 <= number_value <= 20:
            raise ValueError("Male volunteer IDs must be M01-M20.")
        if prefix == "F" and not 1 <= number_value <= 75:
            raise ValueError("Female volunteer IDs must be F01-F75.")
        if prefix == "U" and not 1 <= number_value <= 99:
            raise ValueError("Unspecified volunteer IDs must be U01-U99.")
        return f"{prefix}{number_value:02d}"

    @field_validator("consent")
    @classmethod
    def require_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Consent is required")
        return value

    @model_validator(mode="after")
    def validate_id_gender_pair(self) -> "RecordingFields":
        expected_prefix = {"female": "F", "male": "M", "unspecified": "U"}[self.gender_category.value]
        if self.participant_id[0] != expected_prefix:
            raise ValueError(
                f"{self.gender_category.value.title()} volunteers must use "
                f"{expected_prefix}-prefixed IDs."
            )
        return self


class RecordingResult(BaseModel):
    recording_id: str
    status: str
    message: str
    original_filename: str | None = None
    standardized_filename: str | None = None
    drive_file_id: str | None = None
