r"""Generate a local HTML gallery of every Spendova email in light and dark mode.

Run from backend/:  .\.venv\Scripts\python.exe scripts\preview_emails.py [--text]
Then open app/email_previews/index.html. Uses fictional names and codes only.
"""

import argparse
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.model_helpers import utcnow  # noqa: E402
from app.services import email_templates as templates  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", action="store_true", help="Also write plain-text versions to plaintext/")
    args = parser.parse_args()
    output = Path(__file__).resolve().parents[1] / "app" / "email_previews"
    output.mkdir(exist_ok=True)

    examples = {
        "verify-email": templates.verification_email("Priya Sharma", "307164"),
        "forgot-password": templates.password_reset_email("Priya Sharma", "482915"),
        "google-sign-in": templates.google_sign_in_notice("Priya Sharma"),
        "password-changed": templates.password_changed_email("Priya Sharma", utcnow()),
    }
    for name, content in examples.items():
        subject, text, html = templates.render(content, preview=True)
        html = html.replace(
            '<table class="s-bg"',
            '<div style="padding:8px;text-align:center;font:12px Arial;color:#5B6E75">'
            "Preview only &middot; fictional names and codes</div>"
            '<table class="s-bg"',
            1,
        )
        (output / f"{name}.html").write_text(html, encoding="utf-8")
        dark = html.replace("</head>", "<style>" + templates.render_dark_styles(force=True) + "</style></head>")
        (output / f"{name}.dark.html").write_text(dark, encoding="utf-8")
        if args.text:
            (output / "plaintext").mkdir(exist_ok=True)
            (output / "plaintext" / f"{name}.txt").write_text(f"Subject: {subject}\n\n{text}", encoding="utf-8")

    links = "".join(
        f'<div class="preview-pair"><span>{escape(name.replace("-", " ").title())}</span>'
        f'<a href="{name}.html" target="email-preview">Light</a>'
        f'<a href="{name}.dark.html" target="email-preview">Dark</a></div>'
        for name in examples
    )
    (output / "index.html").write_text(templates.render_preview_gallery(links), encoding="utf-8")
    print(f"Generated {len(examples) * 2} previews and index.html in {output}")


if __name__ == "__main__":
    main()
