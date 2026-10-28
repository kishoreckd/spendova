from fastapi import APIRouter, Header, Request

from app.core.deps import Auth, DbSession
from app.schemas.loans import (
    InstallmentRead,
    LoanCreate,
    LoanPaymentCreate,
    LoanPaymentRead,
    LoanPreview,
    LoanPreviewRequest,
    LoanRead,
    LoansOverview,
)
from app.services import loans_service as service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/loans", tags=["loans"])


@router.get("", response_model=list[LoanRead])
def list_loans(auth: Auth, db: DbSession, include_closed: bool = False):
    return service.list_loans(db, auth.id, include_closed)


@router.get("/overview", response_model=LoansOverview)
def loans_overview(auth: Auth, db: DbSession):
    """Monthly EMI load, what is still owed, what ends this month, and EMI-to-income ratio."""
    return service.overview(db, auth.id)


@router.post("/preview", response_model=LoanPreview)
def preview_loan(payload: LoanPreviewRequest, auth: Auth):
    """Calculates totals and the schedule without saving (used while filling in the form)."""
    _ = auth
    return service.preview(payload)


@router.post("", response_model=LoanRead, status_code=201)
def create_loan(payload: LoanCreate, request: Request, auth: Auth, db: DbSession):
    loan = service.create_loan(db, auth.id, payload)
    record(
        db,
        request,
        AuditAction.LOAN_CREATE,
        user_id=auth.id,
        target_type="loan",
        target_id=loan.id,
        details={"type": loan.loan_type},
    )
    db.commit()
    db.refresh(loan)
    return service.read_loan(db, auth.id, loan.id)[0]


@router.get("/{loan_id}/schedule", response_model=list[InstallmentRead])
def loan_schedule(loan_id: str, auth: Auth, db: DbSession):
    """Every EMI with its interest/principal split, remaining balance, and paid flag."""
    return service.read_loan(db, auth.id, loan_id)[1]


@router.post("/{loan_id}/payments", response_model=LoanPaymentRead)
def pay_installment(
    loan_id: str,
    payload: LoanPaymentCreate,
    request: Request,
    auth: Auth,
    db: DbSession,
    idempotency_key: str = Header(min_length=8, max_length=100),
):
    """Records the next EMI as a transaction from the loan's paying account."""
    loan, transaction, paid, created = service.pay_installment(db, auth.id, loan_id, payload, idempotency_key)
    if created:
        record(
            db,
            request,
            AuditAction.LOAN_PAY,
            user_id=auth.id,
            target_type="loan",
            target_id=loan.id,
            details={"installment": paid, "transaction_id": transaction.id},
        )
        db.commit()
        db.refresh(transaction)
    return LoanPaymentRead.model_validate(
        {"loan": service.read_loan(db, auth.id, loan.id)[0], "transaction": transaction}
    )


@router.post("/{loan_id}/close", response_model=LoanRead)
def close_loan(loan_id: str, request: Request, auth: Auth, db: DbSession):
    """Marks a loan closed (for example after a foreclosure) and stops its EMI reminder."""
    loan = service.close_loan(db, auth.id, loan_id)
    record(db, request, AuditAction.LOAN_CLOSE, user_id=auth.id, target_type="loan", target_id=loan.id)
    db.commit()
    return service.read_loan(db, auth.id, loan.id)[0]
