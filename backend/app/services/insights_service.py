"""Read-only user-scoped context. Raw ledger records stay on the server."""

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.finance import MONEY, add_months, affordability
from app.db.models.account_model import Account
from app.db.models.goal_model import Goal
from app.db.models.transaction_model import Transaction
from app.db.models.user_model import User
from app.schemas.insights import AssistantReply, AssistantRequest, FinanceSnapshot
from app.services import loans_service
from app.services.accounts_service import to_read


def snapshot(db: Session, user_id: str) -> FinanceSnapshot:
    user = db.get(User, user_id)
    if not user:
        raise AppError.not_found("Profile not found")
    try:
        today = datetime.now(ZoneInfo(user.time_zone)).date()
    except (ZoneInfoNotFoundError, ValueError):
        today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    end = today.replace(day=1)
    start = add_months(end, -3)
    filters = [
        Transaction.user_id == user_id,
        Transaction.status == "cleared",
        Transaction.occurred_on >= start,
        Transaction.occurred_on < end,
    ]
    rows = db.execute(
        select(Transaction.kind, func.sum(Transaction.amount))
        .where(*filters, Transaction.currency == user.base_currency)
        .group_by(Transaction.kind)
    ).all()
    totals = {kind: Decimal(value) for kind, value in rows}
    income = (totals.get("income", Decimal(0)) / 3).quantize(MONEY, rounding=ROUND_HALF_UP)
    spending = (totals.get("expense", Decimal(0)) / 3).quantize(MONEY, rounding=ROUND_HALF_UP)
    income_dates = db.scalars(
        select(Transaction.occurred_on).where(
            *filters, Transaction.currency == user.base_currency, Transaction.kind == "income"
        )
    ).all()
    income_months = len({(day.year, day.month) for day in income_dates})
    excluded = (
        db.scalar(select(func.count(Transaction.id)).where(*filters, Transaction.currency != user.base_currency)) or 0
    )
    loans = [
        loan
        for loan in loans_service.list_loans(db, user_id)
        if loan.currency == user.base_currency and loan.summary.installments_left > 0
    ]
    goals = db.scalars(select(Goal).where(Goal.user_id == user_id, Goal.saved_amount < Goal.target_amount)).all()
    goal_saving = sum((goal.monthly_required for goal in goals), Decimal(0))
    warnings = [
        "Based on the last three complete months; missing records reduce reliability.",
        "Spending includes recorded EMI payments. New or unrecorded commitments may reduce headroom.",
        "Headroom is before unrecorded bills, investments and emergency reserves; it is not guaranteed spare cash.",
    ]
    if income_months < 3:
        warnings.append("Fewer than three months contain income. Affordability cannot be confirmed.")
    if excluded:
        warnings.append("Other-currency transactions are excluded; no exchange rates are assumed.")
    deposit_accounts = db.scalars(
        select(Account).where(
            Account.user_id == user_id,
            Account.archived.is_(False),
            Account.currency == user.base_currency,
            Account.account_type.in_(["fixed_deposit", "recurring_deposit"]),
        )
    ).all()
    deposits = []
    for index, account in enumerate(deposit_accounts):
        projection = to_read(account, []).deposit_projection
        deposits.append(
            {
                "reference": f"Deposit {index + 1}",
                "type": account.account_type,
                "matures_on": str(account.maturity_on) if account.maturity_on else None,
                "projection": projection.model_dump(mode="json") if projection else None,
            }
        )
    return FinanceSnapshot(
        deposits=deposits,
        as_of=today,
        currency=user.base_currency,
        period_start=start,
        period_end=end,
        average_income=income,
        average_spending=spending,
        monthly_emi=sum((loan.summary.emi for loan in loans), Decimal(0)),
        monthly_goal_saving=goal_saving,
        monthly_headroom=income - spending - goal_saving,
        income_months=income_months,
        excluded_currency_transactions=excluded,
        loans=[
            {
                "reference": f"Loan {index + 1}",
                "annual_rate": str(loan.summary.annual_rate),
                "outstanding": str(loan.summary.outstanding_principal),
                "remaining_interest": str(loan.summary.remaining_interest),
                "ends_on": str(loan.summary.last_due_on),
            }
            for index, loan in enumerate(sorted(loans, key=lambda item: item.summary.annual_rate, reverse=True))
        ],
        warnings=warnings,
        ai_available=bool(get_settings().openai_api_key),
    )


def reply(db: Session, user_id: str, payload: AssistantRequest) -> AssistantReply:
    context = snapshot(db, user_id)
    calculation = None
    if payload.scenario:
        terms = payload.scenario
        try:
            calculation = affordability(
                context.average_income,
                context.average_spending,
                context.monthly_emi,
                context.monthly_goal_saving,
                terms.price,
                terms.down_payment,
                terms.months,
                terms.annual_rate,
            )
        except ValueError as exc:
            raise AppError.bad_request(str(exc)) from exc
    answer = local_answer(context, payload.question, calculation)
    mode = "local"
    if payload.use_ai:
        config = get_settings()
        if not config.openai_api_key:
            raise AppError.unavailable("AI chat is not configured. Switch off Use AI for the local assistant.")
        from app.services.finance_agent import explain

        answer, calculation = explain(context, payload, calculation, user_id)
        mode = "ai"
    return AssistantReply(answer=answer, mode=mode, snapshot=context, calculation=calculation)


def local_answer(context: FinanceSnapshot, question: str, calculation: dict | None) -> str:
    currency = context.currency
    if calculation:
        return (
            f"New monthly EMI: {currency} {calculation['new_emi']}. "
            f"Interest: {currency} {calculation['interest']}. "
            f"Headroom after this EMI: {currency} {calculation['headroom_after_emi']}. "
            "A positive result alone does not confirm affordability. Check unrecorded commitments, "
            "down-payment funds and emergency reserves before deciding.\n\n" + "\n".join(context.warnings)
        )
    question = question.lower()
    if any(word in question for word in ("deposit", "fixed", " fd", " rd", "maturity")) or {"fd", "rd"} & set(
        question.split()
    ):
        if not context.deposits:
            return "No FD/RD accounts recorded in your base currency. Add one under Accounts."
        lines = []
        for deposit in context.deposits:
            projection = deposit.get("projection") or {}
            value = projection.get("estimated_maturity")
            lines.append(
                f"{deposit['reference']}: maturity {deposit['matures_on'] or 'date not set'}; "
                f"estimated value {currency} {value if value is not None else 'rate not set'}."
            )
        return "\n".join(lines) + "\nEstimates use monthly compounding, before tax and bank adjustments."

    if any(word in question for word in ("loan", "debt", "close", "repay")):
        answer = (
            (
                "Repayment priority by interest rate:\n"
                + "\n".join(
                    f"{loan['reference']}: {loan['annual_rate']}% annual rate; "
                    f"outstanding {currency} {loan['outstanding']}."
                    for loan in context.loans
                )
            )
            if context.loans
            else "You have no active loans in your base currency."
        )
        return answer + "\nCheck foreclosure fees and retain an emergency reserve before prepaying."
    if any(word in question for word in ("buy", "afford", "purchase", "emi", "laptop", "phone")):
        return (
            "Open Purchase check and enter the price, down payment, tenure and quoted annual rate. "
            "I will calculate the EMI, interest and effect on your monthly headroom."
        )
    return (
        f"Average monthly income: {currency} {context.average_income}.\n"
        f"Average spending: {currency} {context.average_spending}.\n"
        f"Planned goal savings: {currency} {context.monthly_goal_saving}.\n"
        f"Monthly headroom: {currency} {context.monthly_headroom}.\n\n"
        "Protect an emergency reserve before increasing investments. "
        "I can summarise savings, rank loan repayment priorities, or check a purchase. "
        "Free-form follow-up questions require Use AI.\n\n" + "\n".join(context.warnings)
    )
