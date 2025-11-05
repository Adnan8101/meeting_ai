"""
Simple health check endpoint to test if basic Flask works
"""
from flask import Flask, jsonify
import sys
import os

app = Flask(__name__)

@app.route('/api/health')
@app.route('/health')
@app.route('/')
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "python_version": sys.version,
        "cwd": os.getcwd(),
        "env_vars": {
            "FLASK_SECRET_KEY": "Set" if os.environ.get("FLASK_SECRET_KEY") else "Missing",
            "GEMINI_API_KEY": "Set" if os.environ.get("GEMINI_API_KEY") else "Missing",
            "TRELLO_API_KEY": "Set" if os.environ.get("TRELLO_API_KEY") else "Missing",
        }
    })

if __name__ == "__main__":
    app.run()
