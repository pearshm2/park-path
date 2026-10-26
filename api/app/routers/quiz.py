"""
Quiz routes (all require a signed-in user):

  GET    /quiz   my saved answers, or null if I haven't taken it
  PUT    /quiz   save my answers (replacing any before)
  DELETE /quiz   forget them, so the app asks again

The app keeps a copy on the phone and sends the answers with each
POST /recommendations, so the engine never reads them from here. This is
just so a new phone, or a reinstall, doesn't ask for the quiz again.
"""

from fastapi import APIRouter, Depends, Response, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import SavedQuiz

router = APIRouter()


@router.get("", response_model=SavedQuiz | None)
def read_quiz(me: User = Depends(get_current_user)):
    if me.quiz_answers is None:
        return None
    # Saved under an older shape of the quiz: ask again rather than fail.
    try:
        return SavedQuiz.model_validate(me.quiz_answers)
    except ValidationError:
        return None


@router.put("", response_model=SavedQuiz)
def save_quiz(
    answers: SavedQuiz, me: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    me.quiz_answers = answers.model_dump(mode="json")
    db.commit()
    return answers


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def forget_quiz(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    me.quiz_answers = None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
