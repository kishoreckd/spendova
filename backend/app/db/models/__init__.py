"""Register all database mappings; import models from their named modules."""

from app.db.models.account_model import Account
from app.db.models.asset_model import Asset
from app.db.models.audit_log_model import AuditLog
from app.db.models.budget_line_model import BudgetLine
from app.db.models.budget_model import Budget
from app.db.models.category_model import Category
from app.db.models.email_outbox_model import EmailOutbox
from app.db.models.email_verification_code_model import EmailVerificationCode
from app.db.models.goal_contribution_model import GoalContribution
from app.db.models.goal_model import Goal
from app.db.models.ledger_entry_model import LedgerEntry
from app.db.models.loan_model import Loan
from app.db.models.password_reset_code_model import PasswordResetCode
from app.db.models.recurring_rule_model import RecurringRule
from app.db.models.transaction_model import Transaction
from app.db.models.user_model import User

__all__ = [
    "User",
    "EmailVerificationCode",
    "PasswordResetCode",
    "Account",
    "Category",
    "Transaction",
    "LedgerEntry",
    "RecurringRule",
    "Budget",
    "BudgetLine",
    "Goal",
    "GoalContribution",
    "Asset",
    "Loan",
    "AuditLog",
    "EmailOutbox",
]
