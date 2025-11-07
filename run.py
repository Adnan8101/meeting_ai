#!/usr/bin/env python3
"""
AI Meeting Agent - MongoDB Edition
Enhanced with email notifications and password reset
"""

import os
from main_app import create_app

if __name__ == '__main__':
    print("🚀 Starting AI Meeting Agent with MongoDB...")
    
    app = create_app()
    
    # Check if all required environment variables are set
    required_vars = ['MONGO_URL', 'SENDER_EMAIL', 'SENDER_PASSWORD', 'GEMINI_API_KEY']
    missing_vars = [var for var in required_vars if not os.environ.get(var)]
    
    if missing_vars:
        print(f"⚠️  Warning: Missing environment variables: {', '.join(missing_vars)}")
        print("Some features may not work properly.")
    
    print("✅ MongoDB integration: Enabled")
    print("📧 Email notifications: Enabled")
    print("🔐 Password reset: Enabled")
    print("🔗 Trello integration: Available")
    print("💬 Slack integration: Available")
    print("\n🌐 Access your app at: http://localhost:5000")
    
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=True
    )
