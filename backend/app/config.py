"""Backward-compatible import path; new code uses app.core.config."""

from .core.config import Settings, get_settings

__all__ = ["Settings", "get_settings"]
