"""
WSGI entry point for Vercel deployment
"""
import os
from main_app import create_app

app = create_app()

# Initialize MongoDB connection (handled in create_app)
# This runs only once when the function cold starts
with app.app_context():
    try:
        # MongoDB initialization is handled in main_app.py create_app function
        print("[*] Using MongoDB - connection handled in create_app")
    except Exception as e:
        # Log but don't crash - database might already exist
        print(f"[INFO] Database initialization: {e}")

if __name__ == "__main__":
    app.run()
