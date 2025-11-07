"""
Vercel build script - runs during deployment
"""
import os

def build():
    """
    Build script for Vercel deployment
    This runs during the build phase
    """
    
    # Ensure required directories exist
    os.makedirs('instance', exist_ok=True)
    

if __name__ == "__main__":
    build()
