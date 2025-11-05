"""
WSGI entry point for Vercel deployment
"""
import os
from main_app import create_app

app = create_app()

# Initialize database tables for serverless environment
# This runs only once when the function cold starts
with app.app_context():
    try:
        from extensions import db
        # Only create tables if using SQLite (development)
        # For production, use proper database migrations
        if 'sqlite' in app.config.get('SQLALCHEMY_DATABASE_URI', ''):
            db.create_all()
    except Exception as e:
        # Log but don't crash - database might already exist
        print(f"[INFO] Database initialization: {e}")

if __name__ == "__main__":
    app.run()
