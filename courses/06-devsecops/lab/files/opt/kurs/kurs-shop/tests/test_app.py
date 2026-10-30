import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
from app import app  # noqa: E402


def test_health():
    assert app.test_client().get("/health").json == {"status": "ok"}


def test_products():
    rows = app.test_client().get("/products?q=ka").json
    assert {r[1] for r in rows} == {"kafa", "kakao"}
