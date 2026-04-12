"""Lightweight logging helpers.

This replaces the previous custom logger system with simple stdlib logging.
"""

import logging
import os
from typing import Any

LOG_LEVEL_NAME = (os.environ.get("APP_LOG_LEVEL") or "WARNING").upper()
LOG_LEVEL = getattr(logging, LOG_LEVEL_NAME, logging.WARNING)

logging.basicConfig(
    level=LOG_LEVEL,
    format="[%(levelname)s] %(asctime)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

app_logger = logging.getLogger("app")
database_logger = logging.getLogger("database")
email_logger = logging.getLogger("email")
integration_logger = logging.getLogger("integration")
security_logger = logging.getLogger("security")
access_logger = logging.getLogger("access")


def log_request(logger: logging.Logger, request: Any, user: Any = None) -> None:
    user_name = getattr(user, "username", "anonymous") if user else "anonymous"
    logger.info("REQUEST %s %s user=%s", request.method, request.path, user_name)


def log_response(logger: logging.Logger, request: Any, response: Any, duration_ms: float | None = None) -> None:
    if duration_ms is None:
        logger.info("RESPONSE %s %s status=%s", request.method, request.path, response.status_code)
    else:
        logger.info(
            "RESPONSE %s %s status=%s duration_ms=%.2f",
            request.method,
            request.path,
            response.status_code,
            duration_ms,
        )


def log_error(logger: logging.Logger, error: Exception, context: dict[str, Any] | None = None) -> None:
    if context:
        logger.exception("%s | context=%s", str(error), context)
    else:
        logger.exception("%s", str(error))


def log_database_operation(
    logger: logging.Logger,
    operation: str,
    collection: str | None = None,
    duration_ms: float | None = None,
    success: bool = True,
    error: str | None = None,
) -> None:
    logger.info(
        "DB_%s success=%s collection=%s duration_ms=%s error=%s",
        operation.upper(),
        success,
        collection,
        duration_ms,
        error,
    )


def log_email_operation(
    logger: logging.Logger,
    operation: str,
    recipient: str,
    subject: str | None = None,
    success: bool = True,
    error: str | None = None,
) -> None:
    logger.info(
        "EMAIL_%s success=%s to=%s subject=%s error=%s",
        operation.upper(),
        success,
        recipient,
        subject,
        error,
    )


def log_integration_operation(
    logger: logging.Logger,
    integration: str,
    operation: str,
    success: bool = True,
    details: str | None = None,
    error: str | None = None,
) -> None:
    logger.info(
        "%s_%s success=%s details=%s error=%s",
        integration.upper(),
        operation.upper(),
        success,
        details,
        error,
    )


def log_security_event(
    logger: logging.Logger,
    event_type: str,
    user: str | None = None,
    ip_address: str | None = None,
    success: bool = True,
    reason: str | None = None,
) -> None:
    logger.info(
        "SECURITY_%s success=%s user=%s ip=%s reason=%s",
        event_type.upper(),
        success,
        user,
        ip_address,
        reason,
    )
