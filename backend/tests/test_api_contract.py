"""Reference-backend parity: Swagger, envelopes, DTO filtering and docs access."""

import pytest
from fastapi import BackgroundTasks, FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError

from app.core.config import Settings
from app.core.docs import install_docs
from app.core.errors import AppError, error_response, register_error_handlers
from app.core.openapi import install_openapi
from app.utils.validation.json_validator import ApiJSONResponse
from tests.test_health_email import _production


def test_openapi_matches_wire_contract_for_every_operation(api):
    schema = api.get("/api/openapi.json").json()
    assert "openapi" in schema and "status" not in schema
    assert api.get("/openapi.json").json() == schema
    for methods in schema["paths"].values():
        for operation in methods.values():
            responses = operation["responses"]
            assert "422" not in responses
            for status, response in responses.items():
                if status == "204":
                    assert "content" not in response
                elif status.startswith("2"):
                    body = response["content"]["application/json"]["schema"]
                    assert set(body["properties"]) == {"status", "message", "data"}
                else:
                    assert response["content"]["application/json"]["schema"]["$ref"].endswith("/ApiErrorEnvelope")
    profile = schema["paths"]["/api/v1/auth/me"]["get"]
    assert profile["responses"]["200"]["content"]["application/json"]["schema"]["properties"]["data"] == {
        "$ref": "#/components/schemas/UserRead"
    }
    assert {"SessionBearer": []} in profile["security"]
    assert api.get("/docs").status_code == 200
    assert api.get("/api/docs").status_code == 200


def test_serializer_filters_private_fields_preserves_tasks_and_status():
    app = FastAPI(default_response_class=ApiJSONResponse)
    register_error_handlers(app)
    install_openapi(app)
    completed = []

    class Public(BaseModel):
        id: int

    @app.get("/dto", response_model=Public)
    def dto(background: BackgroundTasks):
        background.add_task(completed.append, "dto")
        return {"id": 1, "private": "secret"}

    @app.get("/accepted", status_code=202)
    def accepted():
        return {"message": "Queued", "sent": True}

    @app.get("/failure")
    def failure(background: BackgroundTasks):
        background.add_task(completed.append, "error")
        return error_response(AppError.bad_request("Failed"), background)

    @app.get("/unexpected")
    def unexpected():
        raise RuntimeError("private connection details")

    with TestClient(app, raise_server_exceptions=False) as client:
        assert client.get("/dto").json() == {"status": "success", "message": "Success", "data": {"id": 1}}
        response = client.get("/accepted")
        assert response.status_code == 202
        assert response.json() == {"status": "success", "message": "Queued", "data": {"sent": True}}
        assert client.get("/failure").json()["data"]["code"] == "VALIDATION_ERROR"
        response = client.get("/unexpected")
        assert response.status_code == 500
        assert response.json()["data"]["code"] == "INTERNAL"
        assert "private connection" not in response.text
    assert completed == ["dto", "error"]


def docs_app(**overrides):
    settings = Settings(_env_file=None, environment="test", **overrides)  # type: ignore[call-arg]
    app = FastAPI(default_response_class=ApiJSONResponse, docs_url=None, openapi_url=None, redoc_url=None)
    register_error_handlers(app)
    install_docs(app, settings)
    return app


def test_docs_login_logout_origin_and_schema_protection():
    app = docs_app(enable_api_docs=True, swagger_username="developer", swagger_password="documentation-test-password")
    with TestClient(app) as client:
        assert "Welcome back" in client.get("/api/docs").text
        for path in ("/api/openapi.json", "/openapi.json", "/redoc"):
            assert client.get(path).status_code == 401
        credentials = {"username": "developer", "password": "documentation-test-password"}
        assert client.post("/api/docs/login", json=credentials).status_code == 403
        assert (
            client.post("/api/docs/login", headers={"Origin": "https://evil.example"}, json=credentials).status_code
            == 403
        )
        headers = {"Origin": "http://testserver"}
        assert (
            client.post("/api/docs/login", headers=headers, json={**credentials, "password": "incorrect"}).status_code
            == 401
        )
        response = client.post("/api/docs/login", headers=headers, json=credentials)
        assert response.json()["status"] == "success"
        assert "HttpOnly" in response.headers["set-cookie"]
        assert "SameSite=strict" in response.headers["set-cookie"]
        assert "SwaggerUIBundle" in client.get("/docs").text
        assert client.get("/api/openapi.json").json()["openapi"]
        assert client.get("/redoc").status_code == 200
        assert client.post("/api/docs/logout", headers=headers).status_code == 200
        assert client.get("/api/openapi.json").status_code == 401
        client.cookies.set("spendova_docs", "tampered")
        assert client.get("/api/openapi.json").status_code == 401


def test_docs_configuration_requires_explicit_credentials():
    with pytest.raises(ValidationError, match="SWAGGER_USERNAME"):
        docs_app(enable_api_docs=True)
    with pytest.raises(ValidationError, match="SWAGGER_PASSWORD"):
        docs_app(enable_api_docs=True, swagger_username="developer", swagger_password="short")


def test_production_docs_disabled_by_default_and_secure_when_enabled():
    app = FastAPI(docs_url=None, openapi_url=None, redoc_url=None)
    install_docs(app, _production())
    with TestClient(app) as client:
        for path in ("/docs", "/api/docs", "/openapi.json", "/api/openapi.json", "/redoc"):
            assert client.get(path).status_code == 404

    app = FastAPI(docs_url=None, openapi_url=None, redoc_url=None)
    install_docs(
        app,
        _production(enable_api_docs=True, swagger_username="developer", swagger_password="documentation-test-password"),
    )
    with TestClient(app, base_url="https://testserver") as client:
        response = client.post(
            "/api/docs/login",
            headers={"Origin": "https://testserver"},
            json={"username": "developer", "password": "documentation-test-password"},
        )
        assert response.status_code == 200
        assert "Secure" in response.headers["set-cookie"]
        assert client.get("/api/openapi.json").status_code == 200


def test_wrong_method_and_validation_do_not_leak_input(api):
    response = api.put("/health")
    assert response.status_code == 405
    assert "GET" in response.headers["allow"]
    assert response.json()["status"] == "error"
    response = api.post("/api/v1/auth/password-reset/verify", json={"email": "invalid", "code": "private-value"})
    assert response.status_code == 400
    assert response.json()["data"]["code"] == "VALIDATION_ERROR"
    assert "private-value" not in response.text
