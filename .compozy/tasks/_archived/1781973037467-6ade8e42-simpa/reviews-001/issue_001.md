---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T15:42:00Z
status: resolved
file: .github/workflows/ci.yml
line: 21
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: CI não cria `.env.docker` exigido pelo compose

## Review Comment

O serviço `api` referencia `env_file: .env.docker`, mas o workflow GHA só copiava `.env.example` para `.env`. Em checkout limpo, `docker compose up` falhava antes dos testes.

**Correção aplicada:** workflow passa a criar `.env.docker` a partir de `.env.docker.example` e usa `--env-file .env.docker` em todos os steps Docker.

## Triage

- Decision: `valid`
- Notes: Resolvido em review round 001 — `.github/workflows/ci.yml`
