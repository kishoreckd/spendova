"""Loans and products bought on EMI.

Terms are stored; everything else (EMI split, totals, progress, due dates) is recalculated
from them with the reducing-balance method in app/core/finance.py. Each tracked loan owns a
monthly bill reminder, and paying an EMI posts a real transaction through that reminder, so
balances, reports, and budgets all see the same money.
"""

from dataclasses import asdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants.finance import (
    LOAN_EMI_CATEGORY,
    LOAN_STATUS_ACTIVE,
    LOAN_STATUS_CLOSED,
    TRANSACTION_STATUS_CLEARED,
    TRANSACTION_STATUS_VOIDED,
)
from app.core.errors import AppError
from app.core.finance import (
    Installment,
    LoanSummary,
    add_months,
    amortization_schedule,
    emi_for,
    implied_annual_rate,
    installments_due_by,
    loan_summary,
)
from app.db.models.asset_model import Asset
from app.db.models.category_model import Category
from app.db.models.loan_model import Loan
from app.db.models.recurring_rule_model import RecurringRule
from app.db.models.transaction_model import Transaction
from app.db.models.user_model import User
from app.schemas.loans import (
    InstallmentRead,
    LoanCreate,
    LoanEnding,
    LoanPaymentCreate,
    LoanPreview,
    LoanPreviewRequest,
    LoanRead,
    LoansOverview,
    LoanSummaryRead,
    LoanTerms,
)
from app.schemas.recurring import RecurringPaymentCreate
from app.services import accounts_service, categories_service, recurring_service


def calculate(terms: LoanTerms) -> tuple[Decimal, Decimal, bool, list[Installment]]:
    """Returns (emi, annual_rate, rate_is_estimated, schedule) or raises a 400 with a plain reason."""
    try:
        if terms.emi_amount is None:
            rate = terms.annual_interest_rate or Decimal(0)
            emi = emi_for(terms.principal, rate, terms.tenure_months)
            estimated = False
        elif terms.annual_interest_rate is None:
            emi = terms.emi_amount
            # Unrounded, so each scheduled EMI equals the offer; summaries display it rounded.
            rate = implied_annual_rate(terms.principal, emi, terms.tenure_months, exact=True)
            estimated = True
        else:
            emi, rate, estimated = terms.emi_amount, terms.annual_interest_rate, False
        schedule = amortization_schedule(terms.principal, rate, emi, terms.tenure_months, terms.first_due_on)
    except ValueError as exc:
        raise AppError.bad_request(str(exc)) from exc
    return emi, rate, estimated, schedule


def assumed_paid(first_due_on: date, months: int, today: date) -> int:
    """EMIs taken as already paid when the user doesn't say: those due before today.

    One due today is left unpaid so it shows as due and can be recorded.
    """
    return installments_due_by(first_due_on, months, today - timedelta(days=1))


def preview(terms: LoanPreviewRequest, today: date | None = None) -> LoanPreview:
    """Totals and schedule for terms that are not saved yet (live form preview)."""
    today = today or date.today()
    emi, rate, estimated, schedule = calculate(terms)
    paid = terms.installments_paid_before
    if paid is None:
        paid = assumed_paid(terms.first_due_on, terms.tenure_months, today)
    paid = min(paid, terms.tenure_months)
    summary = loan_summary(terms.principal, emi, rate, estimated, schedule, paid, terms.processing_fee, today)
    return LoanPreview(summary=_summary_read(summary), schedule=_rows(schedule, paid))


def _summary_read(summary: LoanSummary) -> LoanSummaryRead:
    return LoanSummaryRead.model_validate(asdict(summary))


def _rows(schedule: list[Installment], paid: int) -> list[InstallmentRead]:
    return [InstallmentRead(**asdict(row), paid=row.number <= paid) for row in schedule]


def _terms(loan: Loan) -> LoanTerms:
    return LoanTerms(
        principal=loan.principal,
        annual_interest_rate=loan.annual_interest_rate,
        emi_amount=loan.emi_amount,
        tenure_months=loan.tenure_months,
        first_due_on=loan.first_due_on,
        processing_fee=loan.processing_fee,
    )


def _payments_recorded(db: Session, rule_ids: list[str]) -> dict[str, int]:
    if not rule_ids:
        return {}
    rows = db.execute(
        select(Transaction.recurring_rule_id, func.count(Transaction.id))
        .where(Transaction.recurring_rule_id.in_(rule_ids), Transaction.status != TRANSACTION_STATUS_VOIDED)
        .group_by(Transaction.recurring_rule_id)
    ).tuples()
    return {rule_id: count for rule_id, count in rows if rule_id}


def installments_paid(loan: Loan, recorded: dict[str, int]) -> int:
    return loan.installments_paid_before + recorded.get(loan.recurring_rule_id or "", 0)


def to_read(loan: Loan, paid: int, today: date | None = None) -> tuple[LoanRead, list[Installment]]:
    today = today or date.today()
    emi, rate, estimated, schedule = calculate(_terms(loan))
    summary = loan_summary(loan.principal, emi, rate, estimated, schedule, paid, loan.processing_fee, today)
    values = {column.name: getattr(loan, column.name) for column in Loan.__table__.columns}
    return LoanRead.model_validate({**values, "summary": _summary_read(summary)}), schedule


def get_owned_loan(db: Session, user_id: str, loan_id: str) -> Loan:
    loan = db.scalar(select(Loan).where(Loan.id == loan_id, Loan.user_id == user_id))
    if not loan:
        raise AppError.not_found("Loan not found")
    return loan


def list_loans(db: Session, user_id: str, include_closed: bool = False) -> list[LoanRead]:
    query = select(Loan).where(Loan.user_id == user_id)
    if not include_closed:
        query = query.where(Loan.status == LOAN_STATUS_ACTIVE)
    loans = list(db.scalars(query.order_by(Loan.first_due_on)).all())
    recorded = _payments_recorded(db, [loan.recurring_rule_id for loan in loans if loan.recurring_rule_id])
    return [to_read(loan, installments_paid(loan, recorded))[0] for loan in loans]


def read_loan(db: Session, user_id: str, loan_id: str) -> tuple[LoanRead, list[InstallmentRead]]:
    loan = get_owned_loan(db, user_id, loan_id)
    recorded = _payments_recorded(db, [loan.recurring_rule_id] if loan.recurring_rule_id else [])
    paid = installments_paid(loan, recorded)
    read, schedule = to_read(loan, paid)
    return read, _rows(schedule, paid)


def _emi_category_id(db: Session, user_id: str) -> str | None:
    categories_service.ensure_default_categories(db, user_id)
    return db.scalar(
        select(Category.id).where(
            Category.user_id == user_id, Category.name == LOAN_EMI_CATEGORY, Category.category_type == "expense"
        )
    )


def create_loan(db: Session, user_id: str, payload: LoanCreate, today: date | None = None) -> Loan:
    today = today or date.today()
    emi, _, _, schedule = calculate(payload)
    account = accounts_service.get_active_account(db, user_id, payload.account_id) if payload.account_id else None
    if payload.asset_id and not db.scalar(
        select(Asset.id).where(Asset.id == payload.asset_id, Asset.user_id == user_id)
    ):
        raise AppError.bad_request("Asset not found")
    paid_before = payload.installments_paid_before
    if paid_before is None:
        paid_before = assumed_paid(payload.first_due_on, payload.tenure_months, today)
    user = db.get(User, user_id)
    currency = account.currency if account else (user.base_currency if user else "INR")

    loan = Loan(
        user_id=user_id,
        name=payload.name,
        loan_type=payload.loan_type,
        lender=payload.lender,
        currency=currency,
        principal=payload.principal,
        annual_interest_rate=payload.annual_interest_rate,
        emi_amount=emi,
        tenure_months=payload.tenure_months,
        first_due_on=payload.first_due_on,
        processing_fee=payload.processing_fee,
        installments_paid_before=paid_before,
        account_id=account.id if account else None,
        asset_id=payload.asset_id,
        status=LOAN_STATUS_CLOSED if paid_before >= len(schedule) else LOAN_STATUS_ACTIVE,
        notes=payload.notes,
    )
    if payload.track_payments and loan.status == LOAN_STATUS_ACTIVE:
        upcoming = schedule[paid_before]
        rule = RecurringRule(
            user_id=user_id,
            name=f"{payload.name} EMI",
            kind="expense",
            plan_type="bill",
            amount=upcoming.payment,
            currency=currency,
            frequency="monthly",
            interval=1,
            next_due_on=upcoming.due_on,
            source=account.name if account else "EMI payment",
            destination=payload.lender or payload.name,
            source_account_id=account.id if account else None,
            category_id=_emi_category_id(db, user_id),
        )
        db.add(rule)
        db.flush()
        loan.recurring_rule_id = rule.id
    db.add(loan)
    db.flush()
    return loan


def pay_installment(
    db: Session, user_id: str, loan_id: str, payload: LoanPaymentCreate, idempotency_key: str
) -> tuple[Loan, Transaction, int, bool]:
    """Posts the next EMI as a transaction. Returns (loan, transaction, installments_paid, created)."""
    loan = get_owned_loan(db, user_id, loan_id)
    if loan.status != LOAN_STATUS_ACTIVE:
        raise AppError.bad_request("This loan is already closed")
    if not loan.recurring_rule_id:
        raise AppError.bad_request("Payment tracking is off for this loan")
    _, _, _, schedule = calculate(_terms(loan))
    recorded = _payments_recorded(db, [loan.recurring_rule_id])
    paid = installments_paid(loan, recorded)
    if paid >= len(schedule):
        raise AppError.bad_request("Every EMI for this loan is already paid")

    rule, transaction, created = recurring_service.pay_rule(
        db,
        user_id,
        loan.recurring_rule_id,
        RecurringPaymentCreate(amount=schedule[paid].payment, paid_on=payload.paid_on),
        idempotency_key,
    )
    if not created:
        return loan, transaction, paid, False
    paid += 1
    if paid >= len(schedule):
        loan.status = LOAN_STATUS_CLOSED
        rule.active = False
    else:
        # The reminder follows the loan's own schedule, including a different final EMI.
        rule.amount = schedule[paid].payment
        rule.next_due_on = schedule[paid].due_on
    return loan, transaction, paid, True


def close_loan(db: Session, user_id: str, loan_id: str) -> Loan:
    loan = get_owned_loan(db, user_id, loan_id)
    loan.status = LOAN_STATUS_CLOSED
    if loan.recurring_rule_id:
        rule = db.get(RecurringRule, loan.recurring_rule_id)
        if rule:
            rule.active = False
    return loan


def _average_monthly_income(db: Session, user_id: str, today: date, months: int = 3) -> Decimal | None:
    """Mean cleared income over the last full calendar months (the current month is excluded)."""
    end = today.replace(day=1)
    start = add_months(end, -months)
    total = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.kind == "income",
            Transaction.status == TRANSACTION_STATUS_CLEARED,
            Transaction.occurred_on >= start,
            Transaction.occurred_on < end,
        )
    )
    total = Decimal(total or 0)
    return (total / months).quantize(Decimal("0.01")) if total > 0 else None


def overview(db: Session, user_id: str, today: date | None = None) -> LoansOverview:
    today = today or date.today()
    loans = list_loans(db, user_id)
    summaries = [loan.summary for loan in loans]
    monthly_emi = sum((summary.emi for summary in summaries), Decimal(0))
    income = _average_monthly_income(db, user_id, today)
    return LoansOverview(
        active_loans=len(loans),
        monthly_emi_total=monthly_emi,
        outstanding_principal_total=sum((s.outstanding_principal for s in summaries), Decimal(0)),
        remaining_payable_total=sum((s.remaining_payable for s in summaries), Decimal(0)),
        remaining_interest_total=sum((s.remaining_interest for s in summaries), Decimal(0)),
        due_this_month_total=sum((s.next_payment or Decimal(0) for s in summaries if s.due_this_month), Decimal(0)),
        overdue_count=sum(1 for s in summaries if s.overdue),
        ending_this_month=[
            LoanEnding(id=loan.id, name=loan.name, last_due_on=loan.summary.last_due_on)
            for loan in loans
            if loan.summary.ends_this_month
        ],
        debt_free_on=max((s.last_due_on for s in summaries if s.installments_left), default=None),
        average_monthly_income=income,
        emi_to_income_percent=(monthly_emi * 100 / income).quantize(Decimal("0.1")) if income else None,
    )
