# Lab 1: Sigurnosni code review i popravke

U `/opt/app/app.py` je mali backend za narudžbe sa četiri ranjivosti iz OWASP Top 10:2025. Uz njega je i skup testova `test_app.py` koji provjerava sigurnosno ponašanje. Trenutno testovi padaju.

Tvoj posao je isti kao u stvarnom pull requestu: pronađi problem, popravi ga minimalnom promjenom i pusti testove da potvrde popravku.

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

## Pročitaj kod

```bash
cat -n /opt/app/app.py
```

Prije nego što pogledaš sljedeće korake, pokušaj sam pronaći sve četiri ranjivosti i za svaku reci kojoj OWASP kategoriji pripada.

## A05 Injection: login

Funkcija `login` sastavlja SQL upit spajanjem stringova. Pogledaj šta se dešava sa imenom `marko' --`:

```bash
cd /opt/app
python3 -c "import app; c=app.init_db(); print('ulogovan kao id:', app.login(c, \"marko' --\", 'bilo-sta'))"
```

`--` je SQL komentar, pa provjera lozinke nestaje iz upita. Prepravi upit u **parametrizovan** (`?` umjesto ubacivanja vrijednosti) i pokreni testove:

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

## A01 Broken Access Control: tuđe narudžbe

`get_order` prima `user_id`, ali ga ne koristi. Ana (id 1) može pročitati Markovu narudžbu i adresu:

```bash
python3 -c "import app; c=app.init_db(); print(app.get_order(c, 1, 11))"
```

Popravi tako da **vlasništvo bude dio upita**. Kad narudžba ne pripada korisniku, funkcija vraća `None`, isto kao da ne postoji, da napadač ne bi mogao nabrajati ID-jeve.

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
`WHERE id = ? AND owner_id = ?` sa parametrima `(order_id, user_id)`.
-->
<!-- solution
cd /opt/app && sed -i 's/FROM orders WHERE id = ?", (order_id,))/FROM orders WHERE id = ? AND owner_id = ?", (order_id, user_id))/' app.py
-->

## A02 / A04: hardkodovana tajna

`SECRET_KEY` je zapisan u kodu, pa je u git historiji, u svakoj kopiji repoa i u svakom Docker imageu. Prepravi `load_config()` tako da:

1. čita tajnu iz varijable okruženja `APP_SECRET`,
2. baci izuzetak ako varijabla ne postoji (bez tihe podrazumijevane vrijednosti),
3. literal `dev-secret-123` više ne postoji u fajlu.

```bash
python3 -m unittest -v test_app.TestSecret
```

U stvarnom projektu bi tajnu i **rotirao**, jer je stara već procurila u historiju, i dodao gitleaks u pipeline.

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
`os.environ["X"]` baca `KeyError` ako varijable nema, a upravo to želimo. Obriši i liniju `SECRET_KEY = ...`.
-->
<!-- solution
cd /opt/app && sed -i '/^SECRET_KEY = /d; s/return {"secret_key": SECRET_KEY}/return {"secret_key": os.environ["APP_SECRET"]}/' app.py
-->

## A10: fail closed

`is_admin` vraća `True` kad vanjski servis za ovlasti baci izuzetak. Dovoljno je da napadač izazove timeout tog servisa i svi postaju admini. Popravi tako da greška znači **odbijanje**.

```bash
python3 -m unittest -v test_app.TestFailClosed
python3 -m unittest -v test_app
```

Na kraju moraju proći svi testovi.

<!-- verify
cd /opt/app && python3 -c "
import sys, unittest; sys.path.insert(0,'/var/lib/kurs'); import test_app
r=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromModule(test_app)); sys.exit(0 if r.wasSuccessful() else 1)" 2>&1 | tail -15
exit ${PIPESTATUS[0]}
-->
<!-- hint
U `except` grani vrati `False`. Bolje je i zabilježiti grešku (logging) da bi ispad servisa bio vidljiv, što je veza sa A09.
-->
<!-- solution
cd /opt/app && python3 - <<'PY'
s=open('app.py').read()
s=s.replace("    except Exception:\n        return True","    except Exception:\n        return False")
open('app.py','w').write(s)
PY
-->
