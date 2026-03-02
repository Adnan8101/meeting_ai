"""
Vercel serverless function entry point for AI Meeting Agent
"""
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    # Import and create the Flask app
    from main_app import create_app
    app = create_app()
    print("[SUCCESS] AI Meeting Agent initialized successfully for Vercel")
    
except Exception as e:
    print(f"[ERROR] Failed to initialize app: {e}")
    import traceback
    traceback.print_exc()
    
    # Create a minimal error app
    from flask import Flask, jsonify
    app = Flask(__name__)
    
    @app.route('/')
    @app.route('/<path:path>')
    def error_handler(path=''):
        return jsonify({
            "error": "Application initialization failed",
            "details": str(e),
            "message": "Check Vercel function logs for details"
        }), 500



