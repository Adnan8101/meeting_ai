"""
Vercel serverless function entry point
"""
from wsgi import app

# Vercel expects the WSGI application to be available at the module level
# The function name doesn't matter for Python WSGI apps on Vercel
def handler(environ, start_response):
    """WSGI application handler for Vercel"""
    return app(environ, start_response)
