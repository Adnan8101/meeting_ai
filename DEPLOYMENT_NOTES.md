# Deployment Notes for Vercel

## Critical Issue: Database Persistence on Vercel

### Problem
You're being redirected to the login page after submitting the analyze form because **Vercel's serverless functions use ephemeral storage**. The SQLite database in `/tmp` is cleared between function invocations, causing:

1. User data to disappear after login
2. Session data to become invalid
3. Authentication to fail on subsequent requests

### Solution: Use a Persistent Database

**You MUST set up a PostgreSQL database for Vercel deployment.**

#### Recommended Options:

1. **Vercel Postgres** (Easiest)
   - Go to your Vercel project dashboard
   - Navigate to "Storage" tab
   - Click "Create Database" → "Postgres"
   - Follow the setup wizard
   - Vercel will automatically add `DATABASE_URL` to your environment variables

2. **Neon** (Free tier available)
   - Sign up at https://neon.tech
   - Create a new project
   - Copy the connection string
   - Add to Vercel environment variables as `DATABASE_URL`

3. **Supabase** (Free tier available)
   - Sign up at https://supabase.com
   - Create a new project
   - Go to Settings → Database
   - Copy the connection string (URI format)
   - Add to Vercel environment variables as `DATABASE_URL`

4. **Railway** (Free tier available)
   - Sign up at https://railway.app
   - Create a new PostgreSQL database
   - Copy the connection string
   - Add to Vercel environment variables as `DATABASE_URL`

### How to Add Environment Variable to Vercel

1. Go to your Vercel project dashboard
2. Click on "Settings"
3. Navigate to "Environment Variables"
4. Add:
   - **Name**: `DATABASE_URL`
   - **Value**: Your PostgreSQL connection string
   - **Environments**: Select Production, Preview, and Development
5. Click "Save"
6. Redeploy your application

### Connection String Format

```
postgresql://username:password@host:port/database
```

Example:
```
postgresql://myuser:mypassword@db.example.com:5432/meeting_ai
```

### After Setting Up Database

1. The app will automatically detect `DATABASE_URL`
2. It will use PostgreSQL instead of SQLite
3. Your data will persist across deployments
4. User sessions will work correctly

### Testing

After redeployment with DATABASE_URL:
1. Register a new account
2. Login
3. Submit the analyze form
4. You should see the analysis results modal (not be redirected to login)

### Current Changes Made

I've updated `main_app.py` to:
1. Add proper session configuration for serverless environments
2. Add database connection pooling
3. Add debug logging to track authentication issues
4. Add clearer warnings about ephemeral storage
5. Improve user loader error handling

These changes will help, but **a persistent database is required** for production use on Vercel.
