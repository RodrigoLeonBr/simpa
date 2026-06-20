# SIMPA — Plano A: Infraestrutura + Python ETL

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o schema PostgreSQL completo, instalar dependências Python e entregar dois scripts ETL funcionais: `parse_esus_csv.py` (CSV e-SUS → PostgreSQL) e `sync_sia_mysql.py` (MySQL SIA → PostgreSQL).

**Architecture:** Schema único `schema_full.sql` substitui o `schema_esus.sql` parcial, corrigindo `versao_schema` e adicionando tabelas SIA/cadastros. Dois scripts Python independentes com flags `--json-out` (stdout JSON para o backend web) e `--pg-write` (grava direto no PostgreSQL via psycopg2). Ambos lêem credenciais de `.env`.

**Tech Stack:** Python 3 · psycopg2-binary · mysql-connector-python · pandas · python-dotenv · PostgreSQL 15 (Docker) · MySQL/XAMPP (somente leitura)

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `C:\simpa\schema_full.sql` | CRIAR | Schema completo PostgreSQL (todas as tabelas) |
| `C:\simpa\.env` | CRIAR | Credenciais PG + MySQL (nunca no git) |
| `C:\simpa\.env.example` | CRIAR | Template de variáveis sem valores |
| `C:\simpa\.gitignore` | CRIAR | Ignorar `.env` e `uploads/` |
| `C:\simpa\parse_esus_csv.py` | MODIFICAR | Adicionar flags `--json-out` e `--pg-write` |
| `C:\simpa\sync_sia_mysql.py` | CRIAR | Extrai SIA do MySQL, grava em PostgreSQL |
| `C:\simpa\requirements.txt` | CRIAR | Dependências Python |

---

## Task 1: Descobrir container PostgreSQL e criar banco

**Files:**
- Nenhum arquivo criado — comandos Docker

- [ ] **Step 1: Listar containers Docker em execução**

```powershell
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
```

Esperado: linha com `postgres` ou similar mostrando porta `5432`.  
Anote o nome do container (ex: `postgres`, `simpa-db`, `db`). Substitua `<pg_container>` nos próximos comandos.

- [ ] **Step 2: Verificar se o banco `simpa` já existe**

```powershell
docker exec <pg_container> psql -U postgres -c "\l"
```

Se `simpa` não aparecer na lista, crie:

```powershell
docker exec <pg_container> psql -U postgres -c "CREATE DATABASE simpa;"
```

- [ ] **Step 3: Verificar acesso**

```powershell
docker exec <pg_container> psql -U postgres -d simpa -c "SELECT version();"
```

Esperado: linha com `PostgreSQL 15...`

---

## Task 2: Criar `schema_full.sql`

**Files:**
- Criar: `C:\simpa\schema_full.sql`

- [ ] **Step 1: Criar o arquivo de schema completo**

```sql
-- ============================================================================
-- SIMPA — Schema completo PostgreSQL v3.1.0
-- Substitui schema_esus.sql (nunca foi aplicado ao banco)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. esus_cargas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS esus_cargas (
    id                          BIGSERIAL PRIMARY KEY,
    tipo_relatorio              VARCHAR(60) NOT NULL CHECK (tipo_relatorio IN (
                                    'atendimento_individual',
                                    'atendimento_odontologico',
                                    'atividade_coletiva',
                                    'marcadores_consumo_alimentar',
                                    'procedimentos_individualizados'
                                )),
    competencia                 DATE NOT NULL,
    periodo_inicio              DATE NOT NULL,
    periodo_fim                 DATE NOT NULL,
    municipio                   VARCHAR(120) NOT NULL DEFAULT 'AMERICANA',
    unidade                     VARCHAR(200),
    equipe_codigo               VARCHAR(40),
    equipe_nome                 VARCHAR(200),
    profissional                VARCHAR(200) DEFAULT 'Todos',
    cbo                         VARCHAR(200) DEFAULT 'Todos',
    filtros_personalizados      VARCHAR(200) DEFAULT 'Nenhum',
    dados_processados_em        TIMESTAMP,
    relatorio_gerado_em         TIMESTAMP,
    relatorio_gerado_por        VARCHAR(200),
    registros_identificados     INT,
    registros_nao_identificados INT,
    arquivo_origem              VARCHAR(300) NOT NULL,
    arquivo_path                VARCHAR(500),
    hash_arquivo                VARCHAR(64),
    importado_em                TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (tipo_relatorio, competencia, unidade, equipe_nome)
);

CREATE INDEX IF NOT EXISTS idx_esus_cargas_competencia
    ON esus_cargas (competencia, tipo_relatorio, unidade, equipe_nome);

COMMENT ON TABLE esus_cargas IS
    'Uma linha por arquivo CSV do e-SUS importado. arquivo_path = caminho físico no servidor.';
COMMENT ON COLUMN esus_cargas.arquivo_path IS
    'Caminho físico do CSV original: uploads/esus/{ano}/{mes}/{unidade}/arquivo.csv';

-- ----------------------------------------------------------------------------
-- 2. esus_indicadores_raw
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS esus_indicadores_raw (
    id          BIGSERIAL PRIMARY KEY,
    carga_id    BIGINT NOT NULL REFERENCES esus_cargas(id) ON DELETE CASCADE,
    secao       VARCHAR(150) NOT NULL,
    descricao   VARCHAR(300) NOT NULL,
    ordem       INT NOT NULL,
    valores     JSONB NOT NULL,
    UNIQUE (carga_id, secao, descricao)
);

CREATE INDEX IF NOT EXISTS idx_esus_raw_secao
    ON esus_indicadores_raw (carga_id, secao);
CREATE INDEX IF NOT EXISTS idx_esus_raw_valores_gin
    ON esus_indicadores_raw USING GIN (valores);

COMMENT ON TABLE esus_indicadores_raw IS
    'EAV: uma linha por (seção, descrição) de cada relatório e-SUS. valores = JSONB com colunas normalizadas.';

-- ----------------------------------------------------------------------------
-- 3. dados_consolidados
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dados_consolidados (
    id              BIGSERIAL PRIMARY KEY,
    competencia     DATE NOT NULL,
    municipio       VARCHAR(120) NOT NULL DEFAULT 'AMERICANA',
    unidade         VARCHAR(200) NOT NULL,
    equipe          VARCHAR(200) NOT NULL,
    versao_schema   VARCHAR(20) NOT NULL DEFAULT '3.1.0',
    dados_conteudo  JSONB NOT NULL,
    atualizado_em   TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (competencia, unidade, equipe)
);

CREATE INDEX IF NOT EXISTS idx_dados_consolidados_gin
    ON dados_consolidados USING GIN (dados_conteudo);

COMMENT ON TABLE dados_consolidados IS
    'Payload final /api/v1/dashboard/planejamento por competência/unidade/equipe.';

-- ----------------------------------------------------------------------------
-- 4. unidades_saude
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unidades_saude (
    id          BIGSERIAL PRIMARY KEY,
    codigo      VARCHAR(40) UNIQUE NOT NULL,
    nome        VARCHAR(200) NOT NULL,
    tipo        VARCHAR(40) CHECK (tipo IN ('APS','MAC','Hospitalar','Misto')),
    cnes        VARCHAR(20),
    status      VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em   TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE unidades_saude IS
    'Cadastro de unidades de saúde do município. Substitui texto livre em esus_cargas.unidade no futuro.';

-- ----------------------------------------------------------------------------
-- 5. equipes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipes (
    id          BIGSERIAL PRIMARY KEY,
    codigo      VARCHAR(40) UNIQUE NOT NULL,
    nome        VARCHAR(200) NOT NULL,
    unidade_id  BIGINT REFERENCES unidades_saude(id),
    tipo        VARCHAR(40) CHECK (tipo IN ('ESF','EAP','eSB','eMulti','Outra')),
    status      VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em   TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE equipes IS
    'Cadastro de equipes. codigo = equipe_codigo do e-SUS.';

-- ----------------------------------------------------------------------------
-- 6. sia_sincronizacoes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sia_sincronizacoes (
    id              BIGSERIAL PRIMARY KEY,
    competencia     DATE NOT NULL,
    municipio       VARCHAR(120) NOT NULL DEFAULT 'AMERICANA',
    status          VARCHAR(20) NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','ok','parcial','erro')),
    registros       INT,
    erros           INT NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (competencia)
);

COMMENT ON TABLE sia_sincronizacoes IS
    'Uma linha por competência sincronizada do MySQL/XAMPP (SIA/SUS).';

-- ----------------------------------------------------------------------------
-- 7. sia_producao
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sia_producao (
    id                BIGSERIAL PRIMARY KEY,
    sincronizacao_id  BIGINT NOT NULL REFERENCES sia_sincronizacoes(id) ON DELETE CASCADE,
    competencia       DATE NOT NULL,
    unidade           VARCHAR(200),
    codigo_sigtap     VARCHAR(20) NOT NULL,
    descricao         VARCHAR(300),
    quantidade        INT NOT NULL DEFAULT 0,
    valor_aprovado    NUMERIC(12,2),
    faixa_etaria      VARCHAR(20),
    sexo              CHAR(1) CHECK (sexo IN ('M','F','I')),
    cbo               VARCHAR(10),
    dados_extras      JSONB,
    UNIQUE (sincronizacao_id, unidade, codigo_sigtap, faixa_etaria, sexo, cbo)
);

CREATE INDEX IF NOT EXISTS idx_sia_producao_grupo
    ON sia_producao (competencia, unidade, codigo_sigtap);
CREATE INDEX IF NOT EXISTS idx_sia_producao_demografico
    ON sia_producao (competencia, faixa_etaria, sexo);
CREATE INDEX IF NOT EXISTS idx_sia_producao_cbo
    ON sia_producao (competencia, cbo);
CREATE INDEX IF NOT EXISTS idx_sia_producao_gin
    ON sia_producao USING GIN (dados_extras);

COMMENT ON TABLE sia_producao IS
    'Produção ambulatorial SIA/SUS. faixa_etaria/sexo/cbo são colunas relacionais para GROUP BY eficiente.';
COMMENT ON COLUMN sia_producao.faixa_etaria IS
    'Faixas: 0-4, 5-9, 10-14, 15-19, 20-29, 30-39, 40-49, 50-59, 60-69, 70-79, 80+';
COMMENT ON COLUMN sia_producao.dados_extras IS
    'Colunas adicionais do MySQL ainda não mapeadas — sem exigir migração de schema.';
```

- [ ] **Step 2: Aplicar o schema no PostgreSQL Docker**

```powershell
Get-Content "C:\simpa\schema_full.sql" | docker exec -i <pg_container> psql -U postgres -d simpa
```

Esperado: sequência de `CREATE TABLE`, `CREATE INDEX`, `COMMENT` sem erros.

- [ ] **Step 3: Verificar tabelas criadas**

```powershell
docker exec <pg_container> psql -U postgres -d simpa -c "\dt"
```

Esperado: 7 tabelas listadas: `dados_consolidados`, `equipes`, `esus_cargas`, `esus_indicadores_raw`, `sia_producao`, `sia_sincronizacoes`, `unidades_saude`.

---

## Task 3: Criar `.env`, `.env.example` e `.gitignore`

**Files:**
- Criar: `C:\simpa\.env`
- Criar: `C:\simpa\.env.example`
- Criar: `C:\simpa\.gitignore`

- [ ] **Step 1: Criar `.env` com suas credenciais reais**

```ini
# PostgreSQL (Docker)
PG_HOST=localhost
PG_PORT=5432
PG_DB=simpa
PG_USER=postgres
PG_PASS=sua_senha_aqui

# MySQL/XAMPP (SIA — somente leitura)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=nome_do_banco_sia
MYSQL_USER=usuario_readonly
MYSQL_PASS=senha_mysql
```

> Preencha com os valores reais. `MYSQL_DB` = nome do banco SIA no XAMPP (verifique com `SHOW DATABASES;` no phpMyAdmin).

- [ ] **Step 2: Criar `.env.example` (vai para o git)**

```ini
# PostgreSQL (Docker)
PG_HOST=localhost
PG_PORT=5432
PG_DB=simpa
PG_USER=postgres
PG_PASS=

# MySQL/XAMPP (SIA — somente leitura)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=
MYSQL_USER=
MYSQL_PASS=
```

- [ ] **Step 3: Criar `.gitignore`**

```gitignore
.env
uploads/
__pycache__/
*.pyc
node_modules/
dist/
.superpowers/
```

---

## Task 4: Instalar pacotes Python

**Files:**
- Criar: `C:\simpa\requirements.txt`

- [ ] **Step 1: Criar `requirements.txt`**

```
psycopg2-binary==2.9.9
mysql-connector-python==8.3.0
pandas==2.2.2
python-dotenv==1.0.1
```

- [ ] **Step 2: Instalar**

```powershell
cd C:\simpa
pip install -r requirements.txt
```

Esperado: `Successfully installed psycopg2-binary-... mysql-connector-python-... pandas-... python-dotenv-...`

- [ ] **Step 3: Verificar instalação**

```powershell
python -c "import psycopg2, mysql.connector, pandas, dotenv; print('OK')"
```

Esperado: `OK`

---

## Task 5: Adicionar `--json-out` e `--pg-write` ao `parse_esus_csv.py`

**Files:**
- Modificar: `C:\simpa\parse_esus_csv.py`

- [ ] **Step 1: Substituir a função `main()` e adicionar imports no topo**

Adicione no topo do arquivo (após os imports existentes):

```python
import argparse
import os
from dotenv import load_dotenv
```

- [ ] **Step 2: Adicionar função `write_to_pg()`**

Adicione antes de `main()`:

```python
def write_to_pg(reports):
    """Grava lista de (meta, sections) no PostgreSQL via psycopg2."""
    import psycopg2
    load_dotenv()
    conn = psycopg2.connect(
        host=os.environ["PG_HOST"],
        port=os.environ["PG_PORT"],
        dbname=os.environ["PG_DB"],
        user=os.environ["PG_USER"],
        password=os.environ["PG_PASS"],
    )
    results = []
    try:
        with conn:
            with conn.cursor() as cur:
                for meta, sections in reports:
                    cur.execute("""
                        INSERT INTO esus_cargas (
                            tipo_relatorio, competencia, periodo_inicio, periodo_fim,
                            municipio, unidade, equipe_codigo, equipe_nome,
                            profissional, cbo, filtros_personalizados,
                            dados_processados_em, relatorio_gerado_em,
                            relatorio_gerado_por, registros_identificados,
                            registros_nao_identificados, arquivo_origem
                        ) VALUES (
                            %(tipo_relatorio)s, %(competencia)s, %(periodo_inicio)s,
                            %(periodo_fim)s, %(municipio)s, %(unidade)s,
                            %(equipe_codigo)s, %(equipe_nome)s, %(profissional)s,
                            %(cbo)s, %(filtros_personalizados)s,
                            %(dados_processados_em)s, %(relatorio_gerado_em)s,
                            %(relatorio_gerado_por)s, %(registros_identificados)s,
                            %(registros_nao_identificados)s, %(arquivo_origem)s
                        )
                        ON CONFLICT (tipo_relatorio, competencia, unidade, equipe_nome)
                        DO UPDATE SET
                            arquivo_origem = EXCLUDED.arquivo_origem,
                            importado_em   = now()
                        RETURNING id
                    """, meta)
                    carga_id = cur.fetchone()[0]

                    for sec_name, rows in sections:
                        for descricao, ordem, valores in rows:
                            cur.execute("""
                                INSERT INTO esus_indicadores_raw
                                    (carga_id, secao, descricao, ordem, valores)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (carga_id, secao, descricao)
                                DO UPDATE SET valores = EXCLUDED.valores
                            """, (carga_id, sec_name, descricao, ordem,
                                  json.dumps(valores, ensure_ascii=False)))

                    n_ind = sum(len(r) for _, r in sections)
                    results.append({
                        "carga_id": carga_id,
                        "tipo_relatorio": meta["tipo_relatorio"],
                        "competencia": str(meta["competencia"]),
                        "unidade": meta["unidade"],
                        "equipe_nome": meta["equipe_nome"],
                        "registros_identificados": meta.get("registros_identificados"),
                        "registros_nao_identificados": meta.get("registros_nao_identificados"),
                        "indicadores": n_ind,
                        "status": "ok",
                    })
    finally:
        conn.close()
    return results
```

- [ ] **Step 3: Substituir a função `main()` existente**

Substitua a função `main()` existente por:

```python
def main():
    parser = argparse.ArgumentParser(
        description="SIMPA — Parser e-SUS APS"
    )
    parser.add_argument("input", help="Arquivo .csv ou pasta com .csvs")
    parser.add_argument("output", nargs="?", help="Arquivo .sql de saída (modo legado)")
    parser.add_argument("--json-out", action="store_true",
                        help="Imprime JSON no stdout (sem gravar no banco)")
    parser.add_argument("--pg-write", action="store_true",
                        help="Grava direto no PostgreSQL via psycopg2")
    args = parser.parse_args()

    src = Path(args.input)
    reports = []

    if src.is_dir():
        for path in sorted(src.glob("*.csv")):
            meta, sections = parse_report(path)
            reports.append((meta, sections))
    elif src.is_file():
        meta, sections = parse_report(src)
        reports.append((meta, sections))
    else:
        print(f"Erro: {src} não encontrado", file=sys.stderr)
        sys.exit(1)

    if args.json_out:
        output = []
        for meta, sections in reports:
            entry = {k: str(v) if hasattr(v, "isoformat") else v
                     for k, v in meta.items()}
            entry["sections_count"] = len(sections)
            entry["indicadores_count"] = sum(len(r) for _, r in sections)
            output.append(entry)
        print(json.dumps(output, ensure_ascii=False, default=str))
        return

    if args.pg_write:
        load_dotenv()
        results = write_to_pg(reports)
        print(json.dumps(results, ensure_ascii=False, default=str))
        return

    # Modo legado: gera arquivo SQL
    if not args.output:
        print("Erro: informe o arquivo de saída .sql ou use --json-out/--pg-write",
              file=sys.stderr)
        sys.exit(1)
    sql = build_sql(reports)
    Path(args.output).write_text(sql, encoding="utf-8")
    for meta, sections in reports:
        print(f"OK  {meta['arquivo_origem']} -> {meta['tipo_relatorio']} "
              f"({meta['competencia']}, {meta['unidade']}, {meta['equipe_nome']})")
    print(f"\nSeed SQL gerado em: {args.output}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Testar `--json-out` com um CSV real**

```powershell
cd C:\simpa
python parse_esus_csv.py "Relatório de atendimento individual-20260613175047.csv" --json-out
```

Esperado: JSON no stdout com `tipo_relatorio`, `competencia`, `unidade`, `equipe_nome`, `sections_count`, `indicadores_count`.

- [ ] **Step 5: Testar `--pg-write` com o mesmo CSV**

```powershell
python parse_esus_csv.py "Relatório de atendimento individual-20260613175047.csv" --pg-write
```

Esperado: JSON com `carga_id`, `status: "ok"`, `registros_identificados`.

- [ ] **Step 6: Verificar no banco**

```powershell
docker exec <pg_container> psql -U postgres -d simpa -c "SELECT id, tipo_relatorio, competencia, unidade, equipe_nome, registros_identificados FROM esus_cargas;"
```

Esperado: 1 linha com os dados do CSV.

- [ ] **Step 7: Testar idempotência — rodar o mesmo CSV de novo**

```powershell
python parse_esus_csv.py "Relatório de atendimento individual-20260613175047.csv" --pg-write
```

Esperado: mesmo `carga_id` retornado, sem duplicata no banco.

- [ ] **Step 8: Importar todos os 6 CSVs reais**

```powershell
python parse_esus_csv.py . --pg-write
```

> Nota: modo pasta com `--pg-write` processa todos os `.csv` no diretório atual.

Esperado: 6 linhas de resultado JSON, todas com `"status": "ok"`.

- [ ] **Step 9: Verificar contagem**

```powershell
docker exec <pg_container> psql -U postgres -d simpa -c "SELECT COUNT(*) FROM esus_cargas; SELECT COUNT(*) FROM esus_indicadores_raw;"
```

Esperado: 6 cargas, ~726 indicadores raw.

- [ ] **Step 10: Commit**

```powershell
git init  # se ainda não for repositório git
git add parse_esus_csv.py requirements.txt schema_full.sql .env.example .gitignore
git commit -m "feat(etl): add --json-out and --pg-write flags to parse_esus_csv.py; add full schema"
```

---

## Task 6: Criar `sync_sia_mysql.py`

**Files:**
- Criar: `C:\simpa\sync_sia_mysql.py`

> **Pré-requisito:** Confirme o nome do banco e as tabelas do SIA no XAMPP antes de rodar. Use o phpMyAdmin ou `mysql -u root -p` para listar: `SHOW TABLES;`

- [ ] **Step 1: Criar o arquivo**

```python
#!/usr/bin/env python3
"""
SIMPA - Conector SIA/SUS: MySQL/XAMPP -> PostgreSQL
====================================================

Extrai producao ambulatorial do banco MySQL/XAMPP (SIA/SUS),
transforma e grava em sia_producao no PostgreSQL.

Uso:
    python sync_sia_mysql.py --competencia 2026-05
    python sync_sia_mysql.py --competencia 2026-05 --json-out
    python sync_sia_mysql.py --meses 6
"""

import argparse
import json
import os
import sys
from datetime import date, datetime
from dateutil.relativedelta import relativedelta

import mysql.connector
import pandas as pd
import psycopg2
from dotenv import load_dotenv

load_dotenv()


FAIXA_ETARIA_BINS = [0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 200]
FAIXA_ETARIA_LABELS = [
    "0-4", "5-9", "10-14", "15-19", "20-29",
    "30-39", "40-49", "50-59", "60-69", "70-79", "80+"
]


def conectar_mysql():
    return mysql.connector.connect(
        host=os.environ["MYSQL_HOST"],
        port=int(os.environ["MYSQL_PORT"]),
        database=os.environ["MYSQL_DB"],
        user=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASS"],
    )


def conectar_pg():
    return psycopg2.connect(
        host=os.environ["PG_HOST"],
        port=os.environ["PG_PORT"],
        dbname=os.environ["PG_DB"],
        user=os.environ["PG_USER"],
        password=os.environ["PG_PASS"],
    )


def competencia_para_date(competencia: str) -> date:
    """'2026-05' -> date(2026, 5, 1)"""
    ano, mes = competencia.split("-")
    return date(int(ano), int(mes), 1)


def calcular_faixa_etaria(idade):
    """45 -> '40-49'"""
    if pd.isna(idade):
        return None
    for i, limite in enumerate(FAIXA_ETARIA_BINS[1:]):
        if int(idade) < limite:
            return FAIXA_ETARIA_LABELS[i]
    return "80+"


def extrair_sia(conn_mysql, competencia_date: date) -> pd.DataFrame:
    """
    Extrai producao do MySQL para a competencia informada.

    AJUSTE a query abaixo conforme as tabelas reais do seu banco SIA/XAMPP.
    Use phpMyAdmin para descobrir os nomes das colunas e tabelas.
    """
    ano = competencia_date.year
    mes = str(competencia_date.month).zfill(2)

    query = """
        SELECT
            estabelecimento AS unidade,
            procedimento    AS codigo_sigtap,
            descricao_proc  AS descricao,
            SUM(quantidade) AS quantidade,
            SUM(valor_aprovado) AS valor_aprovado,
            idade,
            sexo,
            cbo
        FROM producao_ambulatorial
        WHERE ano_competencia = %(ano)s
          AND mes_competencia = %(mes)s
        GROUP BY
            estabelecimento, procedimento, descricao_proc,
            idade, sexo, cbo
    """
    # NOTA: ajuste o nome da tabela (`producao_ambulatorial`) e das colunas
    # conforme o schema real do seu banco SIA no XAMPP.

    df = pd.read_sql(query, conn_mysql, params={"ano": ano, "mes": mes})
    return df


def transformar(df: pd.DataFrame) -> pd.DataFrame:
    """Normaliza tipos e calcula faixa_etaria."""
    df = df.copy()
    df["faixa_etaria"] = df["idade"].apply(calcular_faixa_etaria)
    df["sexo"] = df["sexo"].str.upper().str.strip().where(
        df["sexo"].str.upper().str.strip().isin(["M", "F"]), other="I"
    )
    df["cbo"] = df["cbo"].astype(str).str.strip().replace("nan", None)
    df["quantidade"] = pd.to_numeric(df["quantidade"], errors="coerce").fillna(0).astype(int)
    df["valor_aprovado"] = pd.to_numeric(df["valor_aprovado"], errors="coerce")
    return df


def gravar_pg(conn_pg, df: pd.DataFrame, competencia_date: date) -> dict:
    """Grava DataFrame transformado no PostgreSQL."""
    with conn_pg:
        with conn_pg.cursor() as cur:
            # Upsert na tabela de controle
            cur.execute("""
                INSERT INTO sia_sincronizacoes (competencia, status, registros)
                VALUES (%s, 'pendente', %s)
                ON CONFLICT (competencia) DO UPDATE SET
                    status = 'pendente',
                    registros = EXCLUDED.registros,
                    sincronizado_em = now()
                RETURNING id
            """, (competencia_date, len(df)))
            sinc_id = cur.fetchone()[0]

            erros = 0
            for _, row in df.iterrows():
                try:
                    extras = {}  # campos extras do MySQL não mapeados
                    cur.execute("""
                        INSERT INTO sia_producao (
                            sincronizacao_id, competencia, unidade,
                            codigo_sigtap, descricao, quantidade, valor_aprovado,
                            faixa_etaria, sexo, cbo, dados_extras
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (sincronizacao_id, unidade, codigo_sigtap,
                                     faixa_etaria, sexo, cbo)
                        DO UPDATE SET
                            quantidade     = EXCLUDED.quantidade,
                            valor_aprovado = EXCLUDED.valor_aprovado
                    """, (
                        sinc_id, competencia_date,
                        row.get("unidade"), row.get("codigo_sigtap"),
                        row.get("descricao"), int(row.get("quantidade", 0)),
                        row.get("valor_aprovado") if pd.notna(row.get("valor_aprovado")) else None,
                        row.get("faixa_etaria"), row.get("sexo"), row.get("cbo"),
                        json.dumps(extras) if extras else None,
                    ))
                except Exception as e:
                    erros += 1
                    print(f"Erro linha: {e}", file=sys.stderr)

            status = "ok" if erros == 0 else ("parcial" if erros < len(df) else "erro")
            cur.execute("""
                UPDATE sia_sincronizacoes
                SET status = %s, erros = %s, sincronizado_em = now()
                WHERE id = %s
            """, (status, erros, sinc_id))

    return {
        "sincronizacao_id": sinc_id,
        "competencia": str(competencia_date),
        "registros": len(df),
        "erros": erros,
        "status": status,
    }


def sincronizar(competencia: str) -> dict:
    competencia_date = competencia_para_date(competencia)
    conn_mysql = conectar_mysql()
    try:
        df_raw = extrair_sia(conn_mysql, competencia_date)
    finally:
        conn_mysql.close()

    df = transformar(df_raw)
    conn_pg = conectar_pg()
    try:
        result = gravar_pg(conn_pg, df, competencia_date)
    finally:
        conn_pg.close()

    return result


def main():
    parser = argparse.ArgumentParser(description="SIMPA — Sync SIA MySQL -> PostgreSQL")
    parser.add_argument("--competencia", help="Competência no formato YYYY-MM (ex: 2026-05)")
    parser.add_argument("--meses", type=int, help="Sincronizar últimos N meses")
    parser.add_argument("--json-out", action="store_true",
                        help="Imprime resultado JSON no stdout")
    args = parser.parse_args()

    if not args.competencia and not args.meses:
        parser.error("Informe --competencia YYYY-MM ou --meses N")

    competencias = []
    if args.competencia:
        competencias = [args.competencia]
    elif args.meses:
        hoje = date.today()
        for i in range(args.meses):
            d = hoje - relativedelta(months=i)
            competencias.append(f"{d.year}-{str(d.month).zfill(2)}")

    resultados = []
    for comp in competencias:
        print(f"Sincronizando {comp}...", file=sys.stderr)
        result = sincronizar(comp)
        resultados.append(result)
        print(f"  {result['status']} — {result['registros']} registros, "
              f"{result['erros']} erros", file=sys.stderr)

    if args.json_out or True:
        print(json.dumps(resultados, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Adicionar `python-dateutil` ao requirements.txt**

Adicione ao final de `C:\simpa\requirements.txt`:
```
python-dateutil==2.9.0
```

Instale:
```powershell
pip install python-dateutil
```

- [ ] **Step 3: Verificar conexão MySQL**

```powershell
python -c "
import mysql.connector, os
from dotenv import load_dotenv
load_dotenv()
conn = mysql.connector.connect(
    host=os.environ['MYSQL_HOST'], port=int(os.environ['MYSQL_PORT']),
    database=os.environ['MYSQL_DB'], user=os.environ['MYSQL_USER'],
    password=os.environ['MYSQL_PASS']
)
cur = conn.cursor()
cur.execute('SHOW TABLES')
for t in cur.fetchall(): print(t)
conn.close()
"
```

Esperado: lista das tabelas do banco SIA.

> **ANTES de continuar:** identifique na lista acima a tabela de produção ambulatorial e ajuste o nome da tabela e colunas na função `extrair_sia()` do `sync_sia_mysql.py`.

- [ ] **Step 4: Testar sincronização (após ajustar a query)**

```powershell
python sync_sia_mysql.py --competencia 2026-05 --json-out
```

Esperado: JSON com `status: "ok"`, `registros` > 0.

- [ ] **Step 5: Verificar no banco**

```powershell
docker exec <pg_container> psql -U postgres -d simpa -c "
SELECT competencia, COUNT(*) as linhas, SUM(quantidade) as total_procedimentos
FROM sia_producao GROUP BY competencia;"
```

- [ ] **Step 6: Commit**

```powershell
git add sync_sia_mysql.py requirements.txt
git commit -m "feat(etl): add sync_sia_mysql.py — SIA MySQL to PostgreSQL connector"
```

---

## Verificação final do Plano A

- [ ] `docker exec <pg_container> psql -U postgres -d simpa -c "\dt"` → 7 tabelas
- [ ] `python parse_esus_csv.py <csv> --json-out` → JSON válido
- [ ] `python parse_esus_csv.py <csv> --pg-write` → dados em `esus_cargas` + `esus_indicadores_raw`
- [ ] `python sync_sia_mysql.py --competencia 2026-05` → dados em `sia_producao`
- [ ] Reprocessar o mesmo CSV duas vezes → mesma `carga_id`, sem duplicata

**Plano A completo. Prosseguir para Plano B (Backend Node.js).**
