"""
Vercel serverless function entry point
"""
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from main_app import create_app
    
    # Create the Flask app instance
    app = create_app()
    
    # Initialize database for serverless
    with app.app_context():
        try:
            from extensions import db
            # Only create tables if using SQLite (development)
            if 'sqlite' in app.config.get('SQLALCHEMY_DATABASE_URI', ''):
                db.create_all()
                print("[*] Database tables created")
        except Exception as e:
            print(f"[INFO] Database init: {e}")
    
    print("[*] Flask app initialized successfully for Vercel")
    
except Exception as e:
    print(f"[ERROR] Failed to initialize app: {e}")
    import traceback
    traceback.print_exc()
    raise


