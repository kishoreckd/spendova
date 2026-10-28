"""ASGI entry point: `uvicorn app.main:app`."""

from app.core.application import create_app

app = create_app()
