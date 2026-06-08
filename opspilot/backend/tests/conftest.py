"""
Pytest configuration and shared fixtures.
"""
import os

import pytest


@pytest.fixture(scope="session", autouse=True)
def _isolated_investigation_db(tmp_path_factory):
    """Point the SQLite investigation store at a throwaway DB for the whole test
    session so tests never touch the real data/opspilot.db, and disable the
    legacy-JSON migration so a real investigations.json is never imported/renamed."""
    db = tmp_path_factory.mktemp("opspilot-db") / "test.db"
    os.environ["OPSPILOT_DB_PATH"] = str(db)
    from app.services import investigation_store as store

    store._FILE = db.parent / "no-legacy.json"  # nonexistent → JSON migration is a no-op
    store.reset_connection()
    yield
    store.reset_connection()
    os.environ.pop("OPSPILOT_DB_PATH", None)
