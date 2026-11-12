from sqlalchemy.orm import Session

from app.db.session import engine
from app.schemas.transactions import TransactionCreate
from app.services.transactions_service import create_transaction
from tests.helpers import API, category_named, data, expense, sign_up


def test_search_reaches_beyond_the_first_200_and_paginates(api):
    headers = sign_up(api, "history-user")
    with Session(engine) as db:
        for index in range(205):
            payload = TransactionCreate.model_validate(
                {
                    "kind": "expense",
                    "amount": "10",
                    "source": "Bank",
                    "destination": "Food",
                    "merchant": "Old receipt 100%_" if index == 0 else f"Shop {index}",
                    "occurred_on": "2026-01-01" if index == 0 else "2026-11-01",
                }
            )
            create_transaction(db, "history-user", payload, f"history-{index:04}")
        db.commit()
    rows = data(api.get(f"{API}/transactions?search=OLD%20receipt&limit=50", headers=headers))
    assert len(rows) == 1 and rows[0]["merchant"] == "Old receipt 100%_"
    literal = data(api.get(f"{API}/transactions", params={"search": "%_"}, headers=headers))
    assert len(literal) == 1
    ids = []
    for offset in range(0, 250, 50):
        ids.extend(
            item["id"] for item in data(api.get(f"{API}/transactions?limit=50&offset={offset}", headers=headers))
        )
    assert len(ids) == len(set(ids)) == 205
    other = sign_up(api, "other-history-user")
    assert data(api.get(f"{API}/transactions?search=receipt", headers=other)) == []


def test_currency_filters_keep_dashboard_totals_separate(api):
    headers = sign_up(api, "currency-report-user")
    expense(api, headers, "filter-inr-01", currency="INR", amount="100", occurred_on="2026-11-02")
    expense(api, headers, "filter-usd-01", currency="USD", amount="25", occurred_on="2026-11-02")
    summary = data(api.get(f"{API}/dashboard?year=2026&month=11&currency=INR", headers=headers))
    assert summary["spending"] == "100.0000" and summary["transaction_count"] == 1
    rows = data(api.get(f"{API}/transactions?currency=USD&kind=expense&status=cleared", headers=headers))
    assert len(rows) == 1 and rows[0]["currency"] == "USD"
    api.delete(f"{API}/transactions/{rows[0]['id']}", headers=headers)
    assert data(api.get(f"{API}/transactions?currency=USD&status=cleared", headers=headers)) == []
    assert len(data(api.get(f"{API}/transactions?status=voided", headers=headers))) == 1


def test_archived_category_history_is_available_only_to_its_owner(api):
    headers = sign_up(api, "archived-category-user")
    category = category_named(api, headers, "Groceries")
    api.delete(f"{API}/categories/{category['id']}", headers=headers)
    assert category["id"] not in {item["id"] for item in data(api.get(f"{API}/categories", headers=headers))}
    assert category["id"] in {
        item["id"] for item in data(api.get(f"{API}/categories?include_archived=true", headers=headers))
    }
    other = sign_up(api, "other-category-user")
    assert category["id"] not in {
        item["id"] for item in data(api.get(f"{API}/categories?include_archived=true", headers=other))
    }
