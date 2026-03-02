"""
Comprehensive Logging Configuration for AI Meeting Agent
Provides structured logging across all application components
"""

import logging
import logging.handlers
import os
import sys
from datetime import datetime
from pathlib import Path

# Create logs directory if it doesn't exist
LOGS_DIR = Path(__file__).parent / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

# Log file paths
APP_LOG_FILE = LOGS_DIR / 'app.log'
ERROR_LOG_FILE = LOGS_DIR / 'error.log'
ACCESS_LOG_FILE = LOGS_DIR / 'access.log'
DATABASE_LOG_FILE = LOGS_DIR / 'database.log'
EMAIL_LOG_FILE = LOGS_DIR / 'email.log'
INTEGRATION_LOG_FILE = LOGS_DIR / 'integration.log'
SECURITY_LOG_FILE = LOGS_DIR / 'security.log'

# Custom formatter with detailed information
class DetailedFormatter(logging.Formatter):
    """Custom formatter with colors for console and detailed info"""
    
    # Color codes for console output
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m'        # Reset
    }
    
    def __init__(self, use_color=False):
        super().__init__()
        self.use_color = use_color
        
    def format(self, record):
        # Add custom fields
        record.module_name = record.name
        record.timestamp = datetime.utcnow().isoformat()
        
        # Format based on whether it's for console or file
        if self.use_color:
            color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
            reset = self.COLORS['RESET']
            log_format = f"{color}[%(levelname)s]{reset} %(asctime)s - %(name)s - %(funcName)s:%(lineno)d - %(message)s"
        else:
            log_format = "[%(levelname)s] %(asctime)s - %(name)s - %(module)s.%(funcName)s:%(lineno)d - %(message)s"
        
        formatter = logging.Formatter(log_format, datefmt='%Y-%m-%d %H:%M:%S')
        return formatter.format(record)


def setup_logger(name, log_file=None, level=logging.INFO, max_bytes=10*1024*1024, backup_count=5):
    """
    Setup a logger with file and console handlers
    
    Args:
        name: Logger name (usually __name__)
        log_file: Path to log file (optional)
        level: Logging level (default: INFO)
        max_bytes: Maximum size of log file before rotation (default: 10MB)
        backup_count: Number of backup files to keep (default: 5)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # Console handler with colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(DetailedFormatter(use_color=True))
    logger.addHandler(console_handler)
    
    # File handler with rotation if log file is specified
    if log_file:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8'
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(DetailedFormatter(use_color=False))
        logger.addHandler(file_handler)
    
    # Prevent propagation to avoid duplicate logs
    logger.propagate = False
    
    return logger


def get_app_logger():
    """Get the main application logger"""
    return setup_logger('app', APP_LOG_FILE, level=logging.DEBUG)


def get_database_logger():
    """Get the database operations logger"""
    return setup_logger('database', DATABASE_LOG_FILE, level=logging.DEBUG)


def get_email_logger():
    """Get the email service logger"""
    return setup_logger('email', EMAIL_LOG_FILE, level=logging.DEBUG)


def get_integration_logger():
    """Get the integration (Trello, Slack, Jira) logger"""
    return setup_logger('integration', INTEGRATION_LOG_FILE, level=logging.DEBUG)


def get_security_logger():
    """Get the security/authentication logger"""
    return setup_logger('security', SECURITY_LOG_FILE, level=logging.INFO)


def get_access_logger():
    """Get the HTTP access logger"""
    return setup_logger('access', ACCESS_LOG_FILE, level=logging.INFO)


def log_request(logger, request, user=None):
    """
    Log HTTP request details
    
    Args:
        logger: Logger instance
        request: Flask request object
        user: Current user object (optional)
    """
    user_info = f"User: {user.username} (ID: {user.id})" if user else "User: Anonymous"
    logger.info(
        f"REQUEST - {request.method} {request.path} - "
        f"IP: {request.remote_addr} - "
        f"{user_info} - "
        f"User-Agent: {request.user_agent.string[:50]}"
    )


def log_response(logger, request, response, duration_ms=None):
    """
    Log HTTP response details
    
    Args:
        logger: Logger instance
        request: Flask request object
        response: Flask response object
        duration_ms: Request duration in milliseconds (optional)
    """
    duration_str = f" - Duration: {duration_ms}ms" if duration_ms else ""
    logger.info(
        f"RESPONSE - {request.method} {request.path} - "
        f"Status: {response.status_code}{duration_str}"
    )


def log_error(logger, error, context=None):
    """
    Log error with context
    
    Args:
        logger: Logger instance
        error: Exception object
        context: Additional context dictionary (optional)
    """
    import traceback
    error_traceback = traceback.format_exc()
    context_str = f" - Context: {context}" if context else ""
    logger.error(
        f"ERROR - {type(error).__name__}: {str(error)}{context_str}\n"
        f"Traceback:\n{error_traceback}"
    )


def log_database_operation(logger, operation, collection=None, duration_ms=None, success=True, error=None):
    """
    Log database operations
    
    Args:
        logger: Logger instance
        operation: Operation type (e.g., 'insert', 'update', 'delete', 'query')
        collection: Collection/table name
        duration_ms: Operation duration in milliseconds
        success: Whether operation succeeded
        error: Error message if failed
    """
    status = "SUCCESS" if success else "FAILED"
    collection_str = f" - Collection: {collection}" if collection else ""
    duration_str = f" - Duration: {duration_ms}ms" if duration_ms else ""
    error_str = f" - Error: {error}" if error else ""
    
    log_method = logger.info if success else logger.error
    log_method(
        f"DB_{operation.upper()} - {status}{collection_str}{duration_str}{error_str}"
    )


def log_email_operation(logger, operation, recipient, subject=None, success=True, error=None):
    """
    Log email operations
    
    Args:
        logger: Logger instance
        operation: Operation type (e.g., 'send_welcome', 'send_reset')
        recipient: Email recipient
        subject: Email subject
        success: Whether operation succeeded
        error: Error message if failed
    """
    status = "SUCCESS" if success else "FAILED"
    subject_str = f" - Subject: {subject}" if subject else ""
    error_str = f" - Error: {error}" if error else ""
    
    log_method = logger.info if success else logger.error
    log_method(
        f"EMAIL_{operation.upper()} - {status} - To: {recipient}{subject_str}{error_str}"
    )


def log_integration_operation(logger, integration, operation, success=True, details=None, error=None):
    """
    Log integration operations (Trello, Slack, Jira)
    
    Args:
        logger: Logger instance
        integration: Integration name (e.g., 'Trello', 'Slack', 'Jira')
        operation: Operation type (e.g., 'connect', 'disconnect', 'create_card')
        success: Whether operation succeeded
        details: Additional details
        error: Error message if failed
    """
    status = "SUCCESS" if success else "FAILED"
    details_str = f" - Details: {details}" if details else ""
    error_str = f" - Error: {error}" if error else ""
    
    log_method = logger.info if success else logger.error
    log_method(
        f"{integration.upper()}_{operation.upper()} - {status}{details_str}{error_str}"
    )


def log_security_event(logger, event_type, user=None, ip_address=None, success=True, reason=None):
    """
    Log security events (login, logout, password change, etc.)
    
    Args:
        logger: Logger instance
        event_type: Type of security event (e.g., 'login', 'logout', 'password_reset')
        user: Username or email
        ip_address: User's IP address
        success: Whether event succeeded
        reason: Failure reason if applicable
    """
    status = "SUCCESS" if success else "FAILED"
    user_str = f" - User: {user}" if user else ""
    ip_str = f" - IP: {ip_address}" if ip_address else ""
    reason_str = f" - Reason: {reason}" if reason else ""
    
    log_method = logger.info if success else logger.warning
    log_method(
        f"SECURITY_{event_type.upper()} - {status}{user_str}{ip_str}{reason_str}"
    )


# Configure logging for third-party libraries
def configure_third_party_logging():
    """Configure logging for third-party libraries"""
    # Reduce verbosity of noisy libraries
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('requests').setLevel(logging.WARNING)
    logging.getLogger('mongoengine').setLevel(logging.INFO)


# Initialize logging configuration
configure_third_party_logging()

# Create logger instances for easy import
app_logger = get_app_logger()
database_logger = get_database_logger()
email_logger = get_email_logger()
integration_logger = get_integration_logger()
security_logger = get_security_logger()
access_logger = get_access_logger()

# Log startup
app_logger.info("="*80)
app_logger.info("AI Meeting Agent - Logging System Initialized")
app_logger.info(f"Log Directory: {LOGS_DIR}")
app_logger.info("="*80)
