from fastapi import APIRouter, Depends

from app.core.deps import Auth, DbSession
from app.core.rate_limit import RateLimiter
from app.schemas.insights import AssistantReply, AssistantRequest, FinanceSnapshot
from app.services import insights_service

router = APIRouter(prefix="/insights", tags=["finance assistant"])
assistant_limit = RateLimiter("rate_limit_assistant_requests", "assistant")


@router.get("/snapshot", response_model=FinanceSnapshot)
def snapshot(auth: Auth, db: DbSession):
    return insights_service.snapshot(db, auth.id)


@router.post("/chat", response_model=AssistantReply, dependencies=[Depends(assistant_limit)])
def chat(payload: AssistantRequest, auth: Auth, db: DbSession):
    return insights_service.reply(db, auth.id, payload)
