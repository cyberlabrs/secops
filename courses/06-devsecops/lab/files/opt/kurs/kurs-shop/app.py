"""Kurs Shop: mala Flask aplikacija za vježbe (namjerno sadrži ranjivosti)."""
import os
import sqlite3
import subprocess

import yaml
from flask import Flask, jsonify, make_response, request

app = Flask(__name__)
app.config["SECRET_KEY"] = "kurs-shop-dev-secret"

DB_PATH = os.environ.get("DB_PATH", "/tmp/shop.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price REAL)")
    if conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
        conn.executemany("INSERT INTO products (name, price) VALUES (?, ?)",
                         [("kafa", 4.5), ("kakao", 3.2), ("čaj", 2.9)])
        conn.commit()
    return conn


@app.route("/")
def index():
    resp = make_response("<html><head><title>Kurs Shop</title></head>"
                         "<body><h1>Kurs Shop</h1><a href=\"/products?q=ka\">Proizvodi</a></body></html>")
    resp.set_cookie("session_hint", "anon")
    return resp


@app.route("/products")
def products():
    q = request.args.get("q", "")
    rows = get_db().execute(f"SELECT id, name, price FROM products WHERE name LIKE '%{q}%'").fetchall()
    return jsonify(rows)


@app.route("/ping")
def ping():
    host = request.args.get("host", "127.0.0.1")
    out = subprocess.check_output("ping -c 1 " + host, shell=True)
    return out


@app.route("/import", methods=["POST"])
def import_config():
    cfg = yaml.load(request.data, Loader=yaml.Loader)
    return jsonify(cfg)


@app.route("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8080, debug=True)
