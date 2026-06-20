---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: simpa-backend/src/services/estabelecimentosService.js
line: 590
severity: high
author: claude-code
provider_ref:
---

# Issue 002: TOCTOU ao gravar enriquecimento após mudança de perfil

## Review Comment

`upsertEnrichment` lê o perfil via `fetchEstabelecimentoCore` e valida o slug (linhas 590–597), mas `persistEnrichment` ocorre depois sem transação nem re-leitura. Se `updatePerfil` rodar entre a leitura e a gravação, o write vai para a tabela do slug antigo enquanto o estabelecimento já tem outro perfil — viola a regra “slug deve corresponder ao perfil” e cria enriquecimento órfão silencioso.

**Correção sugerida:** envolver leitura + merge + persist em transação com `SELECT … FOR UPDATE` em `estabelecimentos`, ou revalidar `PERFIL_TO_SLUG[estab.perfil] === slug` imediatamente antes do `persistEnrichment`.

## Triage

- Decision: `valid`
- Notes: `upsertEnrichment` agora usa transação PG com `SELECT … FOR UPDATE`, merge e persist no mesmo client. Testes mockam `pool.connect` com client compartilhado.
