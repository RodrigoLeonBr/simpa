"""Shared PostgreSQL / MySQL connection helpers for SIMPA ETL scripts."""

import os

from dotenv import load_dotenv


def load_env():
    load_dotenv()


def pg_connect():
    import psycopg2

    load_env()
    return psycopg2.connect(
        host=os.environ["PG_HOST"],
        port=os.environ["PG_PORT"],
        dbname=os.environ["PG_DB"],
        user=os.environ["PG_USER"],
        password=os.environ["PG_PASS"],
    )


def mysql_connect():
    import mysql.connector

    load_env()
    return mysql.connector.connect(
        host=os.environ["MYSQL_HOST"],
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        database=os.environ["MYSQL_DB"],
        user=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASS"],
    )


def mysql_configured() -> bool:
    load_env()
    required = ("MYSQL_HOST", "MYSQL_DB", "MYSQL_USER", "MYSQL_PASS")
    return all(os.environ.get(key) for key in required)


def mysql_available() -> bool:
    """True when MySQL env vars are set and a TCP connection succeeds."""
    if not mysql_configured():
        return False
    try:
        conn = mysql_connect()
        conn.close()
        return True
    except Exception:
        return False
