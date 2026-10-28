from tests.helpers import API, data, sign_up


def test_goal_projection(api):
    headers = sign_up(api, "goal-planner")
    response = api.post(
        f"{API}/goals",
        headers=headers,
        json={"name": "Car", "target_amount": 900000, "saved_amount": 280000, "months": 31},
    )
    assert response.status_code == 201
    assert data(response)["monthly_required"] == "20000.0000"


def test_goal_contribution_recalculates_monthly_requirement(api):
    headers = sign_up(api, "goal-owner")
    goal = data(
        api.post(
            f"{API}/goals",
            headers=headers,
            json={"name": "Car", "target_amount": 100000, "saved_amount": 10000, "months": 9},
        )
    )
    contribution = api.post(
        f"{API}/goals/{goal['id']}/contributions",
        headers=headers,
        json={"amount": 9000, "contributed_on": "2026-10-20"},
    )
    assert contribution.status_code == 201
    refreshed = data(api.get(f"{API}/goals", headers=headers))[0]
    assert refreshed["saved_amount"] == "19000.0000"
    assert refreshed["monthly_required"] == "9000.0000"


def test_contribution_cannot_exceed_remaining_amount(api):
    headers = sign_up(api, "over-saver")
    goal = data(api.post(f"{API}/goals", headers=headers, json={"name": "Phone", "target_amount": 1000, "months": 2}))
    response = api.post(f"{API}/goals/{goal['id']}/contributions", headers=headers, json={"amount": 1500})
    assert response.status_code == 400


def test_goals_are_private(api):
    owner = sign_up(api, "goal-owner-2")
    stranger = sign_up(api, "goal-stranger")
    goal = data(api.post(f"{API}/goals", headers=owner, json={"name": "Trip", "target_amount": 5000, "months": 5}))
    assert api.delete(f"{API}/goals/{goal['id']}", headers=stranger).status_code == 404
    assert api.delete(f"{API}/goals/{goal['id']}", headers=owner).status_code == 204
