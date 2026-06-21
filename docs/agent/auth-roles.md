# Autenticação e perfis

## Fluxo JWT

1. `POST /auth/login` com `username` + `senha`.
2. `authService.authenticate` valida bcrypt em `usuarios`.
3. Retorna JWT; frontend guarda (localStorage via `AuthContext`).
4. Requests `/api/*` passam `Authorization: Bearer <token>`.
5. `verifyJWT` middleware decodifica → `req.user`.

Arquivos: `routes/auth.js`, `services/authService.js`, `middleware/verifyJWT.js`.

## Perfis de usuário (`usuarios.perfil`)

| Perfil | Acesso típico |
|--------|---------------|
| Administrador | tudo + admin usuários |
| Gestor Secretaria | cadastros, painel, importação |
| Gestor de Unidade | painel filtrado (futuro) |
| Planejamento | cadastros, metas, auditoria |

Lista canônica: `VALID_PERFIS` em `routes/admin.js`.

## Middleware de autorização

| Middleware | Permite |
|------------|---------|
| `requireAdmin` | só Administrador |
| `requireAdminOrPlanning` | Admin + Planejamento |
| `requirePlanningStaff` | Admin + Gestor Secretaria + Planejamento |

Usar em rotas sensíveis (PUT perfil estabelecimento — planejado task 04).

## Frontend

- `AuthContext.tsx`: token, user, `isAuthenticated`, roles helpers.
- `App.tsx`: `ProtectedRoute` redireciona `/login`.
- `navigation.ts`: itens de menu filtrados por `user.perfil`.

## Admin {#admin}

Rotas em `routes/admin.js` (prefixo `/api/admin`):

| Método | Path | Middleware |
|--------|------|------------|
| GET | `/audit-log` | requireAdminOrPlanning |
| GET | `/usuarios` | requireAdmin |
| POST | `/usuarios` | requireAdmin |
| PUT | `/usuarios/:id` | requireAdmin |
| DELETE | `/usuarios/:id` | requireAdmin |
| GET | `/configuracoes` | requireAdmin |
| PUT | `/configuracoes` | requireAdmin |
| GET | `/backup` | requireAdmin |
| POST | `/backup` | requireAdmin |
| GET | `/backup/:filename` | requireAdmin |
| DELETE | `/backup/:filename` | requireAdmin |
| POST | `/backup/restore` | requireAdmin |

Frontend: `pages/Administracao/` (Usuários, Auditoria, Configurações, Backup), `api/admin.ts`.

### Backup PostgreSQL

UI em **Administração → Backup**. Gera/restaura `.sql` sem ferramentas externas para o operador.

- Backups armazenados em `uploads/backups/` (volume Docker).
- Docker: container `api` inclui `postgresql-client` (`pg_dump` / `psql`).
- Restauração exige confirmação `RESTAURAR` (registrada em `audit_log`).
- Variáveis: `BACKUP_MAX_STORED` (default 10), `BACKUP_MAX_RESTORE_MB` (default 500).

## Auditoria

`auditService.logAudit({ usuarioId, acao, recurso, detalhes, ip })`

- Login falho/sucesso em `auth.js`.
- Ações admin em `admin.js`.
- **Planejado:** alteração de perfil estabelecimento.

Tabela: `audit_log` (migration 002).

## Segurança — notas para agentes

- Nunca commitar `.env` / `.env.docker` com secrets reais.
- `JWT_SECRET` obrigatório em produção.
- Senha mínima 8 chars (`validateSenha` em admin).
- Não bypassar `verifyJWT` em rotas de dados.
