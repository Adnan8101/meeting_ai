#!/usr/bin/env python3
"""
AI Meeting Agent - MongoDB Edition
Enhanced with email notifications and password reset
"""

import os
from main_app import create_app
from logger_config import app_logger

if __name__ == '__main__':
    app_logger.info("="*80)
    app_logger.info("🚀 Starting AI Meeting Agent with MongoDB...")
    app_logger.info("="*80)
    
    print("🚀 Starting AI Meeting Agent with MongoDB...")
    
    app = create_app()
    
    # Check if all required environment variables are set
    # Check for both MONGO_URI and MONGO_URL
    mongo_configured = bool(os.environ.get('MONGO_URI') or os.environ.get('MONGO_URL'))
    required_vars_check = ['SENDER_EMAIL', 'SENDER_PASSWORD', 'GEMINI_API_KEY']
    missing_vars = [var for var in required_vars_check if not os.environ.get(var)]
    if not mongo_configured:
        missing_vars.insert(0, 'MONGO_URI or MONGO_URL')
    
    if missing_vars:
        warning_msg = f"Missing environment variables: {', '.join(missing_vars)}"
        app_logger.warning(warning_msg)
        print(f"⚠️  Warning: {warning_msg}")
        print("Some features may not work properly.")
    else:
        app_logger.info("All required environment variables are set")
    
    # Log feature status
    app_logger.info("Feature Status:")
    app_logger.info("- MongoDB integration: Enabled")
    app_logger.info("- Email notifications: Enabled")
    app_logger.info("- Password reset: Enabled")
    app_logger.info("- Trello integration: Available")
    app_logger.info("- Slack integration: Available")
    
    print("✅ MongoDB integration: Enabled")
    print("📧 Email notifications: Enabled")
    print("🔐 Password reset: Enabled")
    print("🔗 Trello integration: Available")
    print("💬 Slack integration: Available")
    
    port = int(os.environ.get('PORT', 5000))
    app_logger.info(f"Starting Flask server on 0.0.0.0:{port}")
    print(f"\n🌐 Access your app at: http://localhost:{port}")
    
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
