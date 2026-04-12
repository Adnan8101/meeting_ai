#!/usr/bin/env python3
"""
AI Meeting Agent - PostgreSQL Edition
Enhanced with email notifications and password reset
"""

import os
from dotenv import load_dotenv

load_dotenv()

from main_app import create_app
from logger_config import app_logger

if __name__ == '__main__':
    app_logger.info("="*80)
    app_logger.info("Starting AI Meeting Agent with PostgreSQL...")
    app_logger.info("="*80)
    
    app = create_app()
    
    # Check if all required environment variables are set
    database_configured = bool(
        os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL')
    )
    sender_email = os.environ.get('SENDER_EMAIL', '').strip()
    sender_password = (
        os.environ.get('SENDER_PASSWORD', '').strip()
        or os.environ.get('SENDER_APP_PASSWORD', '').strip()
        or os.environ.get('GMAIL_APP_PASSWORD', '').strip()
    )
    email_configured = bool(sender_email and sender_password)
    gemini_configured = bool(os.environ.get('GEMINI_API_KEY', '').strip())

    missing_vars = []
    if not email_configured:
        missing_vars.append('SENDER_EMAIL + SENDER_PASSWORD (or SENDER_APP_PASSWORD)')
    if not gemini_configured:
        missing_vars.append('GEMINI_API_KEY')
    if not database_configured:
        missing_vars.insert(0, 'DATABASE_URL or POSTGRES_URL')
    
    if missing_vars:
        warning_msg = f"Missing environment variables: {', '.join(missing_vars)}"
        app_logger.warning(warning_msg)
        print(f"Warning: {warning_msg}")
        print("Some features may not work properly.")
    else:
        app_logger.info("All required environment variables are set")
    
    # Log feature status
    app_logger.info("Feature Status:")
    app_logger.info("- PostgreSQL integration: Enabled")
    app_logger.info(f"- Email notifications: {'Enabled' if email_configured else 'Disabled'}")
    app_logger.info(f"- Password reset: {'Enabled' if email_configured else 'Disabled'}")
    app_logger.info("- Trello integration: Available")
    app_logger.info("- Slack integration: Available")
    
    print("PostgreSQL integration: Enabled")
    print(f"📧 Email notifications: {'Enabled' if email_configured else 'Disabled'}")
    print(f"🔐 Password reset: {'Enabled' if email_configured else 'Disabled'}")
    print("🔗 Trello integration: Available")
    print("💬 Slack integration: Available")
    
    port = int(os.environ.get('PORT', 5000))
    app_logger.info(f"Starting Flask server on 0.0.0.0:{port}")
    print(f"\nAccess your app at: http://localhost:{port}")
    
    try:
        app.run(
            host='0.0.0.0',
            port=port,
            debug=True
        )
    except KeyboardInterrupt:
        app_logger.info("Server stopped by user (KeyboardInterrupt)")
        print("\n\nServer stopped by user")
    except Exception as e:
        app_logger.error(f"Server crashed: {str(e)}")
        from logger_config import log_error
        log_error(app_logger, e)
        raise
