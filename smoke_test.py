from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

tests = [
    ('/health',                                        200),
    ('/api/incidents/active',                          200),
    ('/api/incidents/INC-2024-0847',                   200),
    ('/api/agents/activity?incident_id=INC-2024-0847', 200),
    ('/api/timeline/INC-2024-0847',                    200),
    ('/api/recommendations/INC-2024-0847',             200),
    ('/api/incidents/INC-UNKNOWN',                     404),
    ('/api/timeline/INC-UNKNOWN',                      404),
    ('/api/recommendations/INC-UNKNOWN',               404),
]

all_ok = True
for path, expected in tests:
    r = client.get(path)
    ok = r.status_code == expected
    if not ok:
        all_ok = False
    body = r.json()
    preview = list(body.keys())[:3] if isinstance(body, dict) else 'list[{}]'.format(len(body))
    label = 'PASS' if ok else 'FAIL'
    print('{}  HTTP {}  {}  {}'.format(label, r.status_code, path, preview))

print()
print('All tests passed!' if all_ok else 'SOME TESTS FAILED')
