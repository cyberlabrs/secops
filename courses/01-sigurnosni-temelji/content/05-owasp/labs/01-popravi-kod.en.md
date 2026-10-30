# Lab 1: Security code review and fixes

`/opt/app/app.py` contains a small ordering backend with four vulnerabilities from the OWASP Top 10:2025. Alongside it is a test suite, `test_app.py`, that checks security behavior. Right now the tests fail.

Your job is the same as in a real pull request: find the problem, fix it with a minimal change, and let the tests confirm the fix.

```bash
cd /opt/app
python3 -m unittest -v test_app 2>&1 | tail -20
```

<!-- setup
set -e
mkdir -p /opt/app /var/lib/kurs
cat > /opt/app/app.py <<'PY'
"""Mali backend za narudžbe. Sadrži namjerne ranjivosti za vježbu."""
import hashlib
import os
import sqlite3

SECRET_KEY = "dev-secret-123"


def hash_password(password: str) -> str:
    # scrypt sa fiksnom solju je dovoljan za lab; u produkciji: argon2id + so po korisniku
    return hashlib.scrypt(password.encode(), salt=b"kurs-lab", n=2**14, r=8, p=1).hex()


def init_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT UNIQUE, pw_hash TEXT, role TEXT);
        CREATE TABLE orders (id INTEGER PRIMARY KEY, owner_id INTEGER, item TEXT, address TEXT);
        """
    )
    conn.execute("INSERT INTO users VALUES (1, 'ana', ?, 'user')", (hash_password("ana-lozinka-2026"),))
    conn.execute("INSERT INTO users VALUES (2, 'marko', ?, 'admin')", (hash_password("marko-lozinka-2026"),))
    conn.execute("INSERT INTO orders VALUES (10, 1, 'laptop', 'Zmaja od Bosne 1, Sarajevo')")
    conn.execute("INSERT INTO orders VALUES (11, 2, 'monitor', 'Knez Mihailova 5, Beograd')")
    return conn


# A05 Injection
def login(conn, name: str, password: str):
    """Vraća id korisnika ili None."""
    query = f"SELECT id FROM users WHERE name = '{name}' AND pw_hash = '{hash_password(password)}'"
    row = conn.execute(query).fetchone()
    return row[0] if row else None


# A01 Broken Access Control
def get_order(conn, user_id: int, order_id: int):
    """Vraća (id, item, address) narudžbe ili None."""
    return conn.execute("SELECT id, item, address FROM orders WHERE id = ?", (order_id,)).fetchone()


# A02 Security Misconfiguration / A04 Cryptographic Failures
def load_config() -> dict:
    return {"secret_key": SECRET_KEY}


# A10 Mishandling of Exceptional Conditions
def is_admin(conn, user_id: int, authz_check) -> bool:
    """authz_check je poziv vanjskog servisa za ovlasti; može baciti izuzetak."""
    try:
        return bool(authz_check(user_id))
    except Exception:
        return True
PY
cat > /var/lib/kurs/test_app.py <<'PY'
import os
import unittest

import app


class TestSQLi(unittest.TestCase):
    def setUp(self):
        self.conn = app.init_db()

    def test_normal_login(self):
        self.assertEqual(app.login(self.conn, "ana", "ana-lozinka-2026"), 1)

    def test_wrong_password(self):
        self.assertIsNone(app.login(self.conn, "ana", "pogresna"))

    def test_injection_does_not_bypass(self):
        self.assertIsNone(app.login(self.conn, "marko' --", "bilo-sta"))
        self.assertIsNone(app.login(self.conn, "x' OR '1'='1' --", "bilo-sta"))

    def test_quote_in_name_does_not_crash(self):
        self.assertIsNone(app.login(self.conn, "o'brien", "x"))


class TestAccess(unittest.TestCase):
    def setUp(self):
        self.conn = app.init_db()

    def test_owner_sees_own_order(self):
        self.assertEqual(app.get_order(self.conn, 1, 10)[1], "laptop")

    def test_cannot_see_foreign_order(self):
        self.assertIsNone(app.get_order(self.conn, 1, 11))


class TestSecret(unittest.TestCase):
    def test_reads_from_env(self):
        os.environ["APP_SECRET"] = "iz-okruzenja-xyz"
        try:
            self.assertEqual(app.load_config()["secret_key"], "iz-okruzenja-xyz")
        finally:
            del os.environ["APP_SECRET"]

    def test_missing_env_fails(self):
        os.environ.pop("APP_SECRET", None)
        with self.assertRaises(Exception):
            app.load_config()

    def test_no_hardcoded_secret(self):
        with open(app.__file__) as f:
            self.assertNotIn("dev-secret-123", f.read())


class TestFailClosed(unittest.TestCase):
    def test_true_and_false(self):
        self.assertTrue(app.is_admin(None, 2, lambda uid: True))
        self.assertFalse(app.is_admin(None, 1, lambda uid: False))

    def test_error_means_no(self):
        def broken(uid):
            raise TimeoutError("authz servis ne odgovara")
        self.assertFalse(app.is_admin(None, 1, broken))


if __name__ == "__main__":
    unittest.main()
PY
cp /var/lib/kurs/test_app.py /opt/app/test_app.py
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Sigurnosni code review ===
Kod: /opt/app/app.py   Testovi: cd /opt/app && python3 -m unittest -v test_app
EOF
-->

## Read the code

```bash
cat -n /opt/app/app.py
```

Before looking at the next steps, try to find all four vulnerabilities yourself and name the OWASP category each one belongs to.

## A05 Injection: login

The `login` function builds the SQL query by concatenating strings. See what happens with the name `marko' --`:

```bash
cd /opt/app
python3 -c "import app; c=app.init_db(); print('logged in as id:', app.login(c, \"marko' --\", 'bilo-sta'))"
```

`--` is an SQL comment, so the password check disappears from the query. Rewrite the query as a **parameterized** one (`?` instead of inserting the values) and run the tests:

```bash
nano /opt/app/app.py
python3 -m unittest -v test_app.TestSQLi
```

<!-- verify
cd /opt/app && python3 -c "
import sys, unittest; sys.path.insert(0,'/var/lib/kurs'); import test_app
r=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromTestCase(test_app.TestSQLi)); sys.exit(0 if r.wasSuccessful() else 1)" 2>&1 | tail -15
exit ${PIPESTATUS[0]}
-->
<!-- hint
```python
query = "SELECT id FROM users WHERE name = ? AND pw_hash = ?"
row = conn.execute(query, (name, hash_password(password))).fetchone()
```
-->
<!-- solution
cd /opt/app && python3 - <<'PY'
s=open('app.py').read()
s=s.replace('''    query = f"SELECT id FROM users WHERE name = '{name}' AND pw_hash = '{hash_password(password)}'"
    row = conn.execute(query).fetchone()''','''    query = "SELECT id FROM users WHERE name = ? AND pw_hash = ?"
    row = conn.execute(query, (name, hash_password(password))).fetchone()''')
open('app.py','w').write(s)
PY
-->

## A01 Broken Access Control: other people's orders

`get_order` receives `user_id`, but doesn't use it. Ana (id 1) can read Marko's order and address:

```bash
python3 -c "import app; c=app.init_db(); print(app.get_order(c, 1, 11))"
```

Fix it so that **ownership is part of the query**. When the order doesn't belong to the user, the function returns `None`, the same as if it didn't exist, so an attacker can't enumerate IDs.

```bash
python3 -m unittest -v test_app.TestAccess
```

<!-- verify
cd /opt/app && python3 -c "
import sys, unittest; sys.path.insert(0,'/var/lib/kurs'); import test_app
r=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromTestCase(test_app.TestAccess)); sys.exit(0 if r.wasSuccessful() else 1)" 2>&1 | tail -15
exit ${PIPESTATUS[0]}
-->
<!-- hint
`WHERE id = ? AND owner_id = ?` with the parameters `(order_id, user_id)`.
-->
<!-- solution
cd /opt/app && sed -i 's/FROM orders WHERE id = ?", (order_id,))/FROM orders WHERE id = ? AND owner_id = ?", (order_id, user_id))/' app.py
-->

## A02 / A04: hardcoded secret

`SECRET_KEY` is written in the code, so it's in the git history, in every copy of the repo and in every Docker image. Rewrite `load_config()` so that it:

1. reads the secret from the `APP_SECRET` environment variable,
2. raises an exception if the variable doesn't exist (no silent default value),
3. the literal `dev-secret-123` no longer exists in the file.

```bash
python3 -m unittest -v test_app.TestSecret
```

In a real project you would also **rotate** the secret, because the old one has already leaked into the history, and add gitleaks to the pipeline.

<!-- verify
cd /opt/app && python3 -c "
import sys, unittest; sys.path.insert(0,'/var/lib/kurs'); import test_app
r=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromTestCase(test_app.TestSecret)); sys.exit(0 if r.wasSuccessful() else 1)" 2>&1 | tail -15
exit ${PIPESTATUS[0]}
-->
<!-- hint
```python
def load_config() -> dict:
    return {"secret_key": os.environ["APP_SECRET"]}
```
`os.environ["X"]` raises `KeyError` if the variable is missing, which is exactly what we want. Also delete the `SECRET_KEY = ...` line.
-->
<!-- solution
cd /opt/app && sed -i '/^SECRET_KEY = /d; s/return {"secret_key": SECRET_KEY}/return {"secret_key": os.environ["APP_SECRET"]}/' app.py
-->

## A10: fail closed

`is_admin` returns `True` when the external authorization service raises an exception. All an attacker has to do is cause that service to time out, and everyone becomes an admin. Fix it so that an error means **denial**.

```bash
python3 -m unittest -v test_app.TestFailClosed
python3 -m unittest -v test_app
```

In the end, all tests must pass.

<!-- verify
cd /opt/app && python3 -c "
import sys, unittest; sys.path.insert(0,'/var/lib/kurs'); import test_app
r=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromModule(test_app)); sys.exit(0 if r.wasSuccessful() else 1)" 2>&1 | tail -15
exit ${PIPESTATUS[0]}
-->
<!-- hint
Return `False` in the `except` branch. It's also better to log the error so the service outage is visible, which ties into A09.
-->
<!-- solution
cd /opt/app && python3 - <<'PY'
s=open('app.py').read()
s=s.replace("    except Exception:\n        return True","    except Exception:\n        return False")
open('app.py','w').write(s)
PY
-->
