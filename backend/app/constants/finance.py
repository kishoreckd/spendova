"""Finance vocabulary shared by schemas, services, and seed data."""

ACCOUNT_TYPES = frozenset({"bank", "credit", "cash", "investment", "loan", "fixed_deposit", "recurring_deposit"})
DEPOSIT_ACCOUNT_TYPES = frozenset({"fixed_deposit", "recurring_deposit"})

# Recurring plan type -> the transaction kind it posts.
PLAN_KIND = {"bill": "expense", "income": "income", "investment": "transfer"}
KIND_PLAN = {kind: plan for plan, kind in PLAN_KIND.items()}

# Borrowing: cash loans and products bought on EMI.
LOAN_TYPES = frozenset(
    {"personal", "home", "vehicle", "education", "gold", "business", "product_emi", "credit_card_emi", "other"}
)
LOAN_STATUS_ACTIVE = "active"
LOAN_STATUS_CLOSED = "closed"
LOAN_EMI_CATEGORY = "Loans & EMIs"

TRANSACTION_STATUS_CLEARED = "cleared"
TRANSACTION_STATUS_VOIDED = "voided"
ASSET_STATUS_ACTIVE = "active"
ASSET_STATUS_ARCHIVED = "archived"

# (name, type, Lucide icon, colour) seeded once per user.
DEFAULT_CATEGORIES = (
    ("Housing", "expense", "house", "#0f766e"),
    ("Groceries", "expense", "shopping-basket", "#0891b2"),
    ("Transport", "expense", "car", "#7c3aed"),
    ("Utilities", "expense", "plug", "#ca8a04"),
    ("Healthcare", "expense", "heart-pulse", "#dc2626"),
    ("Entertainment", "expense", "clapperboard", "#db2777"),
    ("Insurance premiums", "expense", "shield-check", "#2563eb"),
    ("Education", "expense", "graduation-cap", "#9333ea"),
    ("Taxes", "expense", "landmark", "#475569"),
    ("Subscriptions", "expense", "calendar-clock", "#ea580c"),
    ("Gifts & donations", "expense", "gift", "#be123c"),
    ("Loans & EMIs", "expense", "landmark", "#b45309"),
    ("Salary", "income", "wallet-cards", "#059669"),
    ("Business & freelance", "income", "briefcase-business", "#0d9488"),
    ("Interest & dividends", "income", "trending-up", "#65a30d"),
    ("Rental income", "income", "house", "#0284c7"),
    ("Pension", "income", "landmark", "#7c3aed"),
    ("Other income", "income", "circle-dollar-sign", "#16a34a"),
)
