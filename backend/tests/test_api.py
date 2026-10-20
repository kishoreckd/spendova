import os
os.environ["DATABASE_URL"]="sqlite:///:memory:"
os.environ["AUTH_REQUIRED"]="false"
from fastapi.testclient import TestClient
from app.main import app

def data(response):
    body = response.json()
    assert body["status"] == "success"
    return body["data"]

def test_transaction_is_persisted_and_idempotent():
    with TestClient(app) as client:
        payload={"kind":"expense","amount":"125.50","source":"bank","destination":"groceries","merchant":"Market","occurred_on":"2026-09-30"}
        headers={"Idempotency-Key":"test-key-0001"}
        first=client.post("/api/v1/transactions",json=payload,headers=headers)
        second=client.post("/api/v1/transactions",json=payload,headers=headers)
        assert first.status_code==201
        assert data(second)["id"]==data(first)["id"]
        assert len(data(first)["entries"])==2
        assert len(data(client.get("/api/v1/transactions")))==1

def test_goal_projection_endpoint():
    with TestClient(app) as client:
        response=client.post("/api/v1/goals",json={"name":"Car","target_amount":900000,"saved_amount":280000,"months":31})
        assert response.status_code==201
        assert data(response)["monthly_required"]=="20000.0000"
