"""
Test script to verify all imports work
"""
import sys
import os

print("Python version:", sys.version)
print("Current directory:", os.getcwd())
print("\nTesting imports...")

try:
    print("1. Testing Flask imports...")
    from flask import Flask
    print("   ✓ Flask imported successfully")
    
    print("2. Testing extensions...")
    from extensions import db, bcrypt, login_manager
    print("   ✓ Extensions imported successfully")
    
    print("3. Testing models...")
    from models import User, Team, TrelloCredentials, TrelloCard, JiraCredentials
    print("   ✓ Models imported successfully")
    
    print("4. Testing google.generativeai...")
    import google.generativeai as genai
    print("   ✓ google.generativeai imported successfully")
    
    print("5. Testing trello...")
    from trello import TrelloClient
    print("   ✓ TrelloClient imported successfully")
    
    print("6. Testing jira...")
    from jira import JIRA
    print("   ✓ JIRA imported successfully")
    
    print("7. Testing app creation...")
    from main_app import create_app
    app = create_app()
    print("   ✓ App created successfully")
    print("   App config:", {k: v for k, v in app.config.items() if 'SECRET' not in k and 'PASSWORD' not in k})
    
    print("\n✅ All imports successful!")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
