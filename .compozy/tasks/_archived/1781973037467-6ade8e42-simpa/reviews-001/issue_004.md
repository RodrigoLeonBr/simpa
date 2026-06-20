---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T15:42:00Z
status: resolved
file: readme.md
line: 228
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Documentação CI apontava `.env` em vez de `.env.docker`

## Review Comment

README instruía `cp .env.example .env`, mas `ci.sh` e Docker usam `.env.docker`. Inconsistência confundia setup local/CI.

**Correção aplicada:** seção CI/E2E atualizada para `.env.docker.example` → `.env.docker`.

## Triage

- Decision: `valid`
- Notes: Resolvido — `readme.md`
