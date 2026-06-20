from dotenv import load_dotenv
import os

load_dotenv()
import mysql.connector

conn = mysql.connector.connect(
    host=os.environ["MYSQL_HOST"],
    port=int(os.environ["MYSQL_PORT"]),
    database=os.environ["MYSQL_DB"],
    user=os.environ["MYSQL_USER"],
    password=os.environ["MYSQL_PASS"],
)
cur = conn.cursor()
for pattern in ["2605", "2505", "605", "202605", "202506", "705"]:
    cur.execute("SELECT COUNT(*) FROM s_prd WHERE prd_cmp = %s", (pattern,))
    print(pattern, cur.fetchone()[0])
cur.execute("SELECT MIN(LENGTH(prd_cmp)), MAX(LENGTH(prd_cmp)) FROM s_prd")
print("cmp length min/max:", cur.fetchone())
cur.execute(
    "SELECT prd_cmp, COUNT(*) c FROM s_prd WHERE LENGTH(prd_cmp)=6 GROUP BY prd_cmp ORDER BY prd_cmp DESC LIMIT 10"
)
print("latest 6-digit:")
for row in cur.fetchall():
    print(" ", row)
for pattern in ["202605", "202505", "202506"]:
    cur.execute("SELECT COUNT(*) FROM s_prd WHERE prd_cmp = %s", (pattern,))
    print(pattern, cur.fetchone()[0])
conn.close()
