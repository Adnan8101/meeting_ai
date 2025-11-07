#!/bin/bash

# AI Meeting Agent - MongoDB Setup Script
echo "🚀 Setting up AI Meeting Agent with MongoDB..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/Update requirements
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "Please create a .env file with your configuration."
    exit 1
fi

# Start the application
echo "🎯 Starting AI Meeting Agent..."
echo "📧 Email service: Enabled"
echo "🗄️  Database: MongoDB"
echo "🔐 Authentication: Enhanced with password reset"

python main_app.py
