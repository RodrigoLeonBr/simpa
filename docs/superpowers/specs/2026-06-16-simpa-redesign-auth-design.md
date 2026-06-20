# SIMPA — Design Spec: Redesign UI v2 + Autenticação JWT + Dark Mode

**Data:** 2026-06-16
**Sessão:** Brainstorming — Redesign completo baseado no protótipo SIMPA.dc.html
**Status:** Aprovado para planejamento de implementação
**Substitui (parcialmente):** `2026-06-13-simpa-frontend-mvp-design.md` (infraestrutura e backend permanecem válidos)

---

## 1. Contexto e motivação

O protótipo `SIMPA_ tela/SIMPA.dc.html` define um design system completo e telas funcionais para todas as páginas do SIMPA. O frontend atual (commit `96f9b46`) implementou o Plano C com tema dark e sidebar de ícones, mas diverge do protótipo validado.

Esta spec cobre:
1. Migração completa do design system para o protótipo (light mode padrão + dark mode)
2. Implementação de todas as telas antes em placeholder (Indicadores, Metas, Relatórios, Cadastros completo, Administração)
3. Autenticação JWT real (tabela `usuarios`, bcrypt, middleware)
4. Sala de Situação (fullscreen telão)
5. Arquivo `docs/design-system.md` como fonte de verdade permanente

---

## 2. Design System

Definido em `docs/design-system.md`. Resumo executivo:

### Fontes
- **IBM Plex Sans** — UI geral (400/500/600/700)
- **IBM Plex Mono** — números, KPIs, códigos, badges (400/500/600)

### Tokens (CSS custom properties)

#### Light mode (padrão)
| Token | Valor |
|-------|-------|
| `--bg-app` | `#eef2f7` |
| `--bg-card` | `#ffffff` |
| `--bg-sidebar` | `#0c2236` |
| `--border` | `#e2e9f1` |
| `--text-primary` | `#0f1b2d` |
| `--brand` | `#0b5fad` |
| `--green` | `#1f8a5b` |
| `--amber` | `#c8862b` |
| `--red` | `#c0392b` |

#### Dark mode (`[data-theme="dark"]`)
| Token | Valor |
|-------|-------|
| `--bg-app` | `#070f1c` |
| `--bg-card` | `#0e1a2e` |
| `--bg-sidebar` | `#050c18` |
| `--border` | `#1c2c44` |
| `--text-primary` | `#eaf1fa` |
| `--brand` | `#0b5fad` (igual) |

Status colors (green/amber/red) **idênticos** em ambos os modos.
Sidebar **sempre** dark-blue independente do tema.

### Implementação do tema
- CSS custom properties em `:root` e `[data-theme="dark"]` no `index.css`
- Toggle armazenado em `localStorage('simpa-theme')`
- `<html data-theme="dark">` aplicado antes do render (evita flash)
- Tailwind mantido para layout/spacing, tokens visuais via CSS vars

---

## 3. App Shell — mudanças em relação ao Plano C

### Sidebar (refatorar completamente)
**Antes:** 56px, ícones apenas, colapsada.
**Depois:** 236px fixa, labels + ícones, dark-blue `var(--bg-sidebar)`.

Estrutura:
```
┌── Logo (48×48 img/fallback monograma "S") + "SIMPA" + "Americana/SP"
├── [MÓDULOS label]
├── Nav items: Painel / Cadastros / Importação / Metas / Indicadores / Relatórios
├── [Administração — separado no fundo]
├── Theme toggle (sol/lua)
└── Rodapé: v0.x · Fase N | ETL e-SUS · SIA · SIHD
```

Item nav: `border-radius: 9px`, ativo = `background: var(--brand)`, inativo = `color: var(--text-sidebar)` hover `#14304e`.

### Topbar (novo componente)
58px, `background: var(--bg-topbar)`, `border-bottom: 1px solid var(--border)`.
- Esquerda: título + breadcrumb
- Direita: botão "▣ Sala de Situação" + divider + avatar (iniciais do perfil) + nome + perfil + botão logout

### FilterBar (atualizar visual)
Fundo `var(--bg-filterbar)`, bordas `var(--border-input)`, labels uppercase `var(--text-muted)`.
Mantém lógica de cascata Unidade → Equipe.

---

## 4. Login page

Rota pública `/login`. Redireciona para `/` se já autenticado.

Layout: split `1.05fr 1fr`
- **Esquerda** `background: #0c2236`: logo, tagline, estatísticas (42 equipes / 11 unidades / ~240k hab)
- **Direita** branca: campos usuário + senha + select perfil + botão "Entrar"

Fluxo:
1. POST `/auth/login` com `{ username, senha, perfil }`
2. Sucesso → salva `{ token, user }` no `AuthContext` + `localStorage`
3. Redirect para `/`
4. Falha → mensagem de erro inline (sem alert)

Segurança: sem reveal de "usuário não existe" vs "senha errada" — sempre "Credenciais inválidas".

---

## 5. Sala de Situação

Rota protegida `/situacao` (ou fullscreen overlay via estado global).
**Decisão:** overlay via estado — sem mudança de rota. Botão "Sala de Situação" na topbar alterna `{ isSituacao: true }` no `AppContext`.

Visual: `position: fixed; inset: 0; z-index: 50; background: #070f1c`

Conteúdo:
- Header: logo + "SALA DE SITUAÇÃO · SIMPA" + competência + status "ao vivo" + botão "↩ Sair do telão"
- Grid 4 colunas: KPI cards grandes (IBM Plex Mono 34px)
- Linha inferior: trend chart (ECharts dark, stroke `#3b9bff`) + progress bars Componente Qualidade APS

---

## 6. Painel — 3 layouts

Substituir tabs APS/MAC/Hospitalar por **layout switcher A/B/C** + dados MAC/Hospitalar como seções dentro dos layouts.

### Layout A — Cards + Trend + Ranking (padrão)
- Grid 3 colunas: 6 KPI cards com sparkline ECharts
- Grid 1.55fr / 1fr: trend chart 12 competências + ranking top 6 unidades com progress bars

### Layout B — Foco Hero
- Hero card dark-blue gradient: KPI principal + subtotais + mini trend
- Grid 3 colunas: 3 KPI cards secundários
- Coluna direita 320px: metas Componente Qualidade (progress bars)

### Layout C — Tabela Densa
- Grid 6 colunas: 6 mini KPI cards
- Tabela: todas as unidades × atendimentos / odonto / cobertura / metas

Switcher: segmented button "A · Cards / B · Foco / C · Tabela" no header do Painel.

**KPIs do Painel:**
- Atendimentos individuais, Cobertura APS, Equipes ativas, Metas atingidas, Produção odontológica, Atividades coletivas

---

## 7. Indicadores — implementação completa

Dados: `indicadores_qualidade[]` no contrato dashboard (B1–B6 + IGM).

Layout: `300px catálogo / 1fr detalhe`

**Catálogo (esquerda):**
- Lista vertical: código colorido (IBM Plex Mono) + nome curto + % executado
- Item selecionado: `border-left: 3px solid var(--brand)`, `background: var(--brand-bg)`
- Header: "Catálogo" + count

**Detalhe (direita):**
- Card header: código badge + categoria + nome completo + descrição
- Métricas: executado (grande, colorido) + meta + status
- Metadados: numerador / denominador / fonte / periodicidade (chips)
- Série histórica: ECharts line + linha tracejada meta
- Comparação entre unidades: progress bars horizontais + marker de meta

---

## 8. Metas — implementação completa

Dados: indicadores com `exec`, `meta`, `atingimento`.

**4 cards resumo:** monitoradas / atingidas / próximas / abaixo (com `var(--green/amber/red)`)

**Tabela:**
- Colunas: indicador (código + nome) + origem + progress bar (exec vs meta + marker) + % atingimento + status badge
- Legenda: verde = atingida / âmbar = próxima (90–99%) / vermelho = abaixo

Regra de negócio: `null` = não apurado, **nunca zero**. Renderizar `—` com badge âmbar.

---

## 9. Relatórios — benchmarking

Seletor de indicador (vem da mesma lista de Indicadores) + competência ativa do FilterBar.

**Tabela ranking:** # / unidade / tipo / progress bar atingimento / vs. média municipal

**Coluna direita:**
- Mapa placeholder: 200px com hachura SVG + pins coloridos (tamanho ∝ volume, cor = status)
- Síntese municipal: média / meta / melhor unidade / unidades acima da meta

**Botões export:** Excel + PDF (visual presente, funcionalidade Fase 2 — sem erro ao clicar, mostrar toast "Em breve").

---

## 10. Cadastros — grid CRUD completo

Nome na UI: **"Cadastros"** (nunca CRUD). Ações: **Novo / Editar / Inativar / Excluir**.

Grid 3 colunas de cards clicáveis:

| Card | Tabela | Campos principais |
|------|--------|-------------------|
| Unidades de Saúde | `unidades_saude` | código, nome, tipo, CNES, endereço, esfera, status |
| Equipes | `equipes` | código e-SUS, nome, unidade vinculada, tipo ESF/EAP, status |
| Procedimentos | `procedimentos` | código SIGTAP, descrição, tipo, tabela referência |
| Prestadores MAC | `prestadores_mac` | nome, CNES, tipo contrato, status |
| Hospitais | `hospitais` | nome, CNES, tipo, nº leitos, status |
| Emendas Parlamentares | `emendas_parlamentares` | id_emenda, esfera, tipo, autor, objeto, valor, status |

Clique no card → abre sub-rota `/cadastros/unidades`, `/cadastros/equipes`, etc.
Cada sub-rota: tabela + formulário inline + ações Editar/Inativar com confirmação.

---

## 11. Administração

Sub-módulos:
- **Usuários e Perfis** — CRUD de usuários (tabela `usuarios`): criar, editar, inativar, redefinir senha
- **Auditoria / Logs** — tabela read-only `audit_log`: quem acessou o quê, quando
- **Configurações Gerais** — competência ativa padrão, parâmetros do sistema

---

## 12. Autenticação JWT

### Backend — novos artefatos

#### Tabela PostgreSQL
```sql
CREATE TABLE usuarios (
  id          BIGSERIAL PRIMARY KEY,
  username    VARCHAR(80) UNIQUE NOT NULL,
  senha_hash  VARCHAR(200) NOT NULL,
  nome        VARCHAR(200) NOT NULL,
  perfil      VARCHAR(40) NOT NULL
              CHECK (perfil IN ('Administrador','Gestor Secretaria','Gestor de Unidade','Planejamento')),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMP NOT NULL DEFAULT now(),
  ultimo_login TIMESTAMP
);

-- Seed: usuário admin padrão (senha: simpa@2026)
INSERT INTO usuarios (username, senha_hash, nome, perfil)
VALUES ('admin', '$2b$10$<hash_gerado>', 'Administrador SIMPA', 'Administrador');
```

#### Rotas auth (`simpa-backend/src/routes/auth.js`)
```
POST /auth/login    → { username, senha } → { token, user: { nome, perfil } }
POST /auth/logout   → stateless, apenas responde { ok: true }
GET  /auth/me       → verifyJWT → { nome, perfil, username }
```

#### Middleware (`simpa-backend/src/middleware/verifyJWT.js`)
- Extrai `Authorization: Bearer <token>`
- Verifica com `jsonwebtoken.verify(token, process.env.JWT_SECRET)`
- Injeta `req.user = { id, username, nome, perfil }`
- 401 se token ausente/inválido/expirado

#### Pacotes novos
```bash
npm install bcrypt jsonwebtoken
```

#### Variáveis `.env`
```env
JWT_SECRET=<string aleatória ≥ 32 chars>
JWT_EXPIRES_IN=8h
```

#### Todas as rotas existentes
Adicionar `verifyJWT` como middleware em todas as rotas `/api/*`.

### Frontend — novos artefatos

#### `src/contexts/AuthContext.tsx`
```typescript
interface AuthUser { nome: string; perfil: string; username: string; }
interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, senha: string, perfil: string) => Promise<void>;
  logout: () => void;
}
```
- `login()`: POST `/auth/login` → salva `{ token, user }` em `localStorage('simpa-auth')`
- `logout()`: remove localStorage → redirect `/login`
- Inicialização: lê localStorage ao montar (persiste entre reloads)

#### `src/components/ProtectedRoute.tsx`
- Se `!token` → redirect `/login`
- Se `token` expirado (decode + check exp) → logout + redirect

#### `src/api/client.ts` — atualizar
- Adicionar `Authorization: Bearer ${token}` em todos os requests
- Interceptar 401 → `logout()` automático

#### `src/api/auth.ts`
```typescript
export async function login(username: string, senha: string, perfil: string)
export async function me(): Promise<AuthUser>
```

---

## 13. Mudanças no contrato dashboard

Adicionar ao `ContratoDashboard.modulos`:

```typescript
indicadores_qualidade: IndicadorQualidade[];
```

```typescript
export interface IndicadorQualidade {
  cod: string;          // 'B1', 'B2', ... 'IGM'
  nomeCurto: string;
  nome: string;
  categoria: string;    // 'Componente Qualidade APS', 'IGM SUS Paulista'
  meta: number | null;  // fração 0..1 — null = não regulamentado
  exec: number | null;  // fração 0..1 — null = não apurado
  num: string;          // numerador formatado
  den: string;          // denominador formatado
  fonte: string;
  periodicidade: string;
  porUnidade?: { unidade: string; exec: number | null }[];
  historico?: { competencia: string; exec: number | null }[];
}
```

---

## 14. Estrutura de arquivos — delta em relação ao Plano C

### Novos arquivos frontend
```
src/
├── contexts/
│   ├── AuthContext.tsx        NOVO — JWT state + login/logout
│   └── AppContext.tsx         NOVO — isSituacao, theme toggle
├── components/
│   ├── ProtectedRoute.tsx     NOVO
│   ├── Logo.tsx               NOVO — img + fallback monograma
│   └── layout/
│       ├── Sidebar.tsx        REESCREVER — 236px + labels
│       ├── Topbar.tsx         NOVO — título + Sala de Situação + perfil
│       └── FilterBar.tsx      ATUALIZAR — visual novo
├── pages/
│   ├── Login/
│   │   └── index.tsx          NOVO
│   ├── Situacao/
│   │   └── index.tsx          NOVO — fullscreen overlay
│   ├── Painel/
│   │   ├── LayoutA.tsx        NOVO (substitui IndicadoresGerais+TabAPS)
│   │   ├── LayoutB.tsx        NOVO
│   │   ├── LayoutC.tsx        NOVO
│   │   └── index.tsx          REESCREVER
│   ├── Indicadores/
│   │   └── index.tsx          REESCREVER — catálogo + drill-down
│   ├── Metas/
│   │   └── index.tsx          REESCREVER — progress bars + resumo
│   ├── Relatorios/
│   │   └── index.tsx          REESCREVER — benchmarking
│   ├── Cadastros/
│   │   ├── index.tsx          NOVO — grid de cards
│   │   ├── Unidades.tsx       MANTER + atualizar visual
│   │   ├── Equipes.tsx        NOVO
│   │   ├── Procedimentos.tsx  NOVO
│   │   ├── PrestadoresMAC.tsx NOVO
│   │   ├── Hospitais.tsx      NOVO
│   │   └── EmendasParl.tsx    NOVO
│   └── Administracao/
│       ├── index.tsx          REESCREVER
│       ├── Usuarios.tsx       NOVO
│       ├── AuditLog.tsx       NOVO
│       └── Configuracoes.tsx  NOVO
└── index.css                  REESCREVER — CSS vars + IBM Plex
```

### Novos arquivos backend
```
simpa-backend/src/
├── routes/
│   └── auth.js               NOVO — login, logout, me
└── middleware/
    └── verifyJWT.js           NOVO — Bearer token validation
```

### Migração de schema
```sql
-- migration_002_usuarios.sql
CREATE TABLE usuarios (...);
INSERT INTO usuarios (seed admin);
```

---

## 15. Sequência de build

1. **Design system** — `index.css` com CSS vars + import IBM Plex Sans no `index.html` + `tailwind.config` atualizado
2. **Auth backend** — tabela `usuarios` + `/auth/login` + middleware `verifyJWT` + proteger todas as rotas
3. **Auth frontend** — `AuthContext` + `ProtectedRoute` + `Login page` + `api/client.ts` com token
4. **App shell** — `Sidebar` (236px) + `Topbar` + `Logo` + `AppContext` (theme toggle + isSituacao)
5. **Sala de Situação** — overlay fullscreen dark
6. **Painel** — 3 layouts A/B/C + switcher
7. **Indicadores** — catálogo + drill-down + série histórica
8. **Metas** — cards resumo + tabela progress bars
9. **Relatórios** — benchmarking + mapa placeholder
10. **Cadastros** — grid cards + sub-rotas CRUD
11. **Administração** — usuários + audit log + configurações
12. **Dark mode** — verificar todas as telas com `[data-theme="dark"]`
13. **Integração** — testar fluxo completo com backend real + dados reais

---

## 16. Fora do escopo desta implementação

- Export Excel/PDF real (botões visuais presentes, funcionalidade Fase 2)
- Mapa georreferenciado GeoJSON (placeholder SVG hachura)
- Refresh automático de token (Fase 2)
- 2FA / SSO institucional (Fase 2)
- Importação SIHD/AIH (Fase anterior — já no backlog)
- Emendas Parlamentares funcionais (tabela de cadastro presente, módulo financeiro Fase 2)
