from fastapi import APIRouter, Header, Request, Response

from app.core.deps import Auth, DbSession
from app.schemas.recurring import RecurringPaymentCreate, RecurringPaymentRead, RecurringRuleCreate, RecurringRuleRead
from app.services import recurring_service as service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/recurring-rules", tags=["recurring money"])


@router.get("", response_model=list[RecurringRuleRead])
def list_rules(auth: Auth, db: DbSession):
    return service.list_rules(db, auth.id)


@router.post("", response_model=RecurringRuleRead, status_code=201)
def create_rule(payload: RecurringRuleCreate, request: Request, auth: Auth, db: DbSession):
    rule = service.create_rule(db, auth.id, payload)
    record(
        db,
        request,
        AuditAction.RECURRING_CREATE,
        user_id=auth.id,
        target_type="recurring_rule",
        target_id=rule.id,
        details={"plan_type": rule.plan_type},
    )
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/{rule_id}/pay", response_model=RecurringPaymentRead)
def pay_rule(
    rule_id: str,
    payload: RecurringPaymentCreate,
    request: Request,
    auth: Auth,
    db: DbSession,
    idempotency_key: str = Header(min_length=8, max_length=100),
):
    """Records the payment as a transaction and schedules the next due date."""
    rule, transaction, created = service.pay_rule(db, auth.id, rule_id, payload, idempotency_key)
    if created:
        record(
            db,
            request,
            AuditAction.RECURRING_PAY,
            user_id=auth.id,
            target_type="recurring_rule",
            target_id=rule.id,
            details={"transaction_id": transaction.id},
        )
        db.commit()
        db.refresh(rule)
        db.refresh(transaction)
    return RecurringPaymentRead.model_validate({"commitment": rule, "transaction": transaction})


@router.delete("/{rule_id}", status_code=204)
def stop_rule(rule_id: str, request: Request, auth: Auth, db: DbSession) -> Response:
    service.stop_rule(db, auth.id, rule_id)
    record(db, request, AuditAction.RECURRING_STOP, user_id=auth.id, target_type="recurring_rule", target_id=rule_id)
    db.commit()
    return Response(status_code=204)
