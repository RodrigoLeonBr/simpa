---
provider: manual
pr:
round: 1
round_created_at: 2026-06-21T15:25:23Z
status: resolved
file: sync_cadastros_mysql.py
line: 615
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Skip de linhas inválidas pode inativar cadastros válidos

## Review Comment

O guard de inativação usa `snapshot_keys` derivado apenas das linhas que passaram em `normalize_*_row` (`sync_formas`/`sync_cbos`). Quando várias linhas vindas do MySQL são ignoradas por validação (ex.: descrição vazia/normalização inválida), essas linhas saem do snapshot e podem ser tratadas como "ausentes", liberando inativação em massa mesmo sem remoção real na origem.

Impacto: com snapshot parcial por qualidade de dados, `formas_sia`/`cbos_sia` podem ser inativadas indevidamente, gerando regressão de catálogo para SIA/SIH.

Sugestão de correção:
- calcular o guard de inativação com base no volume bruto extraído do MySQL (antes dos skips), ou
- bloquear inativação quando `skipped_formas`/`skipped_cbos` for maior que zero acima de um limite aceitável, e
- adicionar teste de integração cobrindo cenário `snapshot parcial + skipped > 0`.

Isso preserva a proteção contra snapshots inconsistentes sem transformar erro de qualidade de dados em inativação indevida.

## Triage

- Decision: `VALID`
- Notes: O problema procede. `sync_formas` e `sync_cbos` calculavam `snapshot_keys` apenas com linhas normalizadas, permitindo falsas ausências quando havia skips por validação. Correção aplicada: `sync_formas`/`sync_cbos` agora recebem `skipped_rows` e bloqueiam inativação quando `skipped_rows > 0`, com warning explícito; `sincronizar` passa `skipped_formas`/`skipped_cbos` para essas funções. Testes adicionados para garantir bloqueio de inativação com skips em formas e cbos. Verificação: `python -m pytest tests/test_sync_cadastros_mysql.py` (42 passed). Observação de ambiente: `npm run test:py` falhou por `pytest` não estar no PATH do script npm no Windows, apesar do `python -m pytest` funcionar.
