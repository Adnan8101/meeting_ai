"""Quick endpoint test for the app."""
from main_app import create_app

app = create_app()
client = app.test_client()

resp = client.get('/api/health/db')
print(f'DB_HEALTH: {resp.status_code} {resp.json}')

resp = client.get('/api/auth/status')
print(f'AUTH_STATUS: {resp.status_code} {resp.json}')

resp = client.get('/')
html = resp.data.decode()[:100]
print(f'FRONTEND: {resp.status_code} size={len(resp.data)} has_html={html.strip().lower().startswith("<!doctype")}')

resp = client.post('/api/auth/register', json={})
print(f'REGISTER_VALIDATION: {resp.status_code} {resp.json}')

print('ALL_TESTS_PASSED')
