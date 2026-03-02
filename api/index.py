"""
Vercel serverless function entry point for AI Meeting Agent
"""
import sys
import os

print(f"[DEBUG] Python version: {sys.version}")
print(f"[DEBUG] Current directory: {os.getcwd()}")
print(f"[DEBUG] Python path: {sys.path}")

# Add parent directory to path to import app modules
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)
print(f"[DEBUG] Added to path: {parent_dir}")

# Check if required files exist
main_app_path = os.path.join(parent_dir, 'main_app.py')
print(f"[DEBUG] main_app.py exists: {os.path.exists(main_app_path)}")

# Create a simple Flask app for debugging
from flask import Flask, jsonify
debug_app = Flask(__name__)

@debug_app.route('/')
@debug_app.route('/<path:path>')
def debug_handler(path=''):
    return jsonify({
        "status": "debug_mode",
        "message": "Function is running but main app failed to initialize",
        "python_version": sys.version,
        "cwd": os.getcwd(),
        "path_requested": path,
        "main_app_exists": os.path.exists(main_app_path)
    })

app = debug_app  # Default to debug app

try:
    print("[DEBUG] Attempting to import main_app...")
    from main_app import create_app
    print("[DEBUG] main_app imported successfully")
    
    print("[DEBUG] Creating Flask app...")
    app = create_app()
    print("[SUCCESS] AI Meeting Agent initialized successfully for Vercel")
    
except ImportError as e:
    print(f"[ERROR] Import failed: {e}")
    # Keep debug_app as fallback
    
except Exception as e:
    print(f"[ERROR] App creation failed: {e}")
    import traceback
    traceback.print_exc()
    # Keep debug_app as fallback

print(f"[DEBUG] Final app object: {type(app)}")
print("[DEBUG] Serverless function initialization complete")



