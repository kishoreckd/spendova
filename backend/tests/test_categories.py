from tests.helpers import API, category_named, data, error, sign_up


def test_default_and_custom_categories_are_user_scoped(api):
    user_a = sign_up(api, "user-a")
    user_b = sign_up(api, "user-b")
    defaults = data(api.get(f"{API}/categories", headers=user_a))
    assert {"Insurance premiums", "Interest & dividends", "Business & freelance"} <= {c["name"] for c in defaults}
    custom = api.post(
        f"{API}/categories",
        headers=user_a,
        json={"name": "Cloud services", "category_type": "expense", "icon": "cloud"},
    )
    assert custom.status_code == 201
    assert all(category["name"] != "Cloud services" for category in data(api.get(f"{API}/categories", headers=user_b)))


def test_defaults_are_seeded_once(api):
    headers = sign_up(api, "seeded-once")
    first = data(api.get(f"{API}/categories", headers=headers))
    second = data(api.get(f"{API}/categories", headers=headers))
    assert len(first) == len(second)


def test_category_can_be_edited_but_not_duplicated_or_taken(api):
    headers = sign_up(api, "category-editor")
    stranger = sign_up(api, "someone-else")
    groceries = category_named(api, headers, "Groceries")
    renamed = api.patch(
        f"{API}/categories/{groceries['id']}",
        headers=headers,
        json={"name": "Food shopping", "color": "#123456", "monthly_budget": "8000"},
    )
    assert data(renamed)["name"] == "Food shopping"
    assert data(renamed)["category_type"] == "expense"

    duplicate = api.patch(f"{API}/categories/{groceries['id']}", headers=headers, json={"name": "Housing"})
    assert duplicate.status_code == 409
    assert error(duplicate)["code"] == "CONFLICT"
    assert api.patch(f"{API}/categories/{groceries['id']}", headers=stranger, json={"name": "Mine"}).status_code == 404


def test_category_type_cannot_be_changed(api):
    headers = sign_up(api, "type-changer")
    groceries = category_named(api, headers, "Groceries")
    response = api.patch(f"{API}/categories/{groceries['id']}", headers=headers, json={"category_type": "income"})
    assert response.status_code == 400


def test_archived_category_is_hidden(api):
    headers = sign_up(api, "archiver")
    groceries = category_named(api, headers, "Groceries")
    assert api.delete(f"{API}/categories/{groceries['id']}", headers=headers).status_code == 204
    assert all(c["id"] != groceries["id"] for c in data(api.get(f"{API}/categories", headers=headers)))
