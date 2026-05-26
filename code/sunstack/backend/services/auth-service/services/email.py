from __future__ import annotations

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib

from core.config import get_settings


def _smtp_config() -> tuple[str | None, int, str | None, str | None, str | None, bool]:
    """Return SMTP config.

    Supports both:
    - SMTP_* variables (preferred)
    - MAIL_USERNAME / MAIL_PASSWORD (compat for existing envs)
    """
    s = get_settings()

    smtp_host = s.smtp_host or "smtp.gmail.com"
    smtp_port = s.smtp_port or 587
    smtp_user = s.smtp_user or getattr(s, "mail_username", None)
    smtp_password = s.smtp_password or getattr(s, "mail_password", None)
    smtp_from = s.smtp_from or smtp_user
    smtp_tls = s.smtp_tls

    return smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, smtp_tls


def _smtp_enabled() -> bool:
    smtp_host, _smtp_port, smtp_user, smtp_password, smtp_from, _smtp_tls = _smtp_config()
    return bool(smtp_host and smtp_user and smtp_password and smtp_from)


def send_verify_email(*, to_email: str, verify_url: str) -> None:
    """Send verification email.

    If SMTP is not configured, we skip sending to avoid breaking registration.
    """
    if not _smtp_enabled():
        return

    smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, smtp_tls = _smtp_config()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your email"
    msg["From"] = smtp_from
    msg["To"] = to_email

    text = f"Please verify your email by visiting: {verify_url}"
    html = f"""
    <html>
      <body>
        <p>Please verify your email:</p>
        <p><a href=\"{verify_url}\">Verify email</a></p>
      </body>
    </html>
    """.strip()

    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
        if smtp_tls:
            server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_from, [to_email], msg.as_string())


def send_reset_password_email(*, to_email: str, reset_url: str) -> None:
    """Send password reset email.

    If SMTP is not configured, we skip sending to avoid breaking flows.
    """
    if not _smtp_enabled():
        return

    smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, smtp_tls = _smtp_config()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your password"
    msg["From"] = smtp_from
    msg["To"] = to_email

    text = f"Reset your password by visiting: {reset_url}"
    html = f"""
    <html>
      <body>
        <p>Reset your password:</p>
        <p><a href=\"{reset_url}\">Reset password</a></p>
      </body>
    </html>
    """.strip()

    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
        if smtp_tls:
            server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_from, [to_email], msg.as_string())
