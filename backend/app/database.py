"""Backward-compatible import path; new code uses app.db.session."""

from .db.session import Base, SessionLocal, engine, get_db

__all__ = ["Base", "SessionLocal", "engine", "get_db"]
