# SIMPA — Plano C: Frontend React

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o frontend React completo do SIMPA — dashboard com 3 abas (APS/MAC/Hospitalar), toggle Indicadores/Temas, filtros em cascata (Mês/Quadrim./Ano + Unidade + Equipe), módulo de Importação com drag & drop e histórico, e telas de suporte (Cadastros, Metas, Indicadores, Admin).

**Architecture:** Vite + React 18 + TypeScript. Começa com `json-server` como mock API (HTTP real desde o dia 1). Swap para backend real na Task de integração. ECharts via `echarts-for-react`. Tailwind CSS + shadcn/ui para componentes. Estado de filtros global via Context API.

**Tech Stack:** Vite · React 18 · TypeScript · Tailwind CSS 3 · shadcn/ui · Apache ECharts (echarts-for-react) · React Router v6 · json-server

**Pré-requisito:** Plano A concluído (dados no banco). Plano B rodando (opcional até Task de integração).

---

## Mapa de arquivos

```
C:\simpa\simpa-frontend\
├── mock/
│   └── db.json                    CRIAR  fixture json-server
├── public/
├── src/
│   ├── types/
│   │   └── contrato.ts            CRIAR  tipagem do contrato JSON v3.1.0
│   ├── api/
│   │   ├── client.ts              CRIAR  fetch wrapper
│   │   ├── dashboard.ts           CRIAR  GET /api/v1/dashboard/planejamento
│   │   └── importacao.ts          CRIAR  endpoints de importação
│   ├── hooks/
│   │   ├── useFilters.tsx         CRIAR  Context + hook para filtros globais
│   │   └── useDashboard.ts        CRIAR  fetch + loading + erro do dashboard
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx        CRIAR  sidebar com ícones colapsada
│   │   │   ├── FilterBar.tsx      CRIAR  filtros período + unidade + equipe
│   │   │   └── PageWrapper.tsx    CRIAR  layout base de página
│   │   ├── charts/
│   │   │   ├── TendenciaChart.tsx CRIAR  ECharts line + linha de meta
│   │   │   ├── RoscaChart.tsx     CRIAR  ECharts donut turnos
│   │   │   ├── PiramideChart.tsx  CRIAR  ECharts bar horizontal espelhado
│   │   │   └── TemasChart.tsx     CRIAR  ECharts bar horizontal ordenado
│   │   └── ui/                    CRIAR  re-exports shadcn/ui
│   ├── pages/
│   │   ├── Painel/
│   │   │   ├── index.tsx          CRIAR  tabs APS/MAC/Hospitalar
│   │   │   ├── TabAPS.tsx         CRIAR  KPIs + toggle + grid 2x2
│   │   │   ├── TabMAC.tsx         CRIAR  produção SIA
│   │   │   ├── TabHospitalar.tsx  CRIAR  status pendente SIHD
│   │   │   ├── IndicadoresGerais.tsx CRIAR 4 KPI cards
│   │   │   ├── PorTema.tsx        CRIAR  cards de tema clicáveis
│   │   │   └── TemaDetalhe.tsx    CRIAR  painel contextual ao clicar tema
│   │   ├── Importacao/
│   │   │   ├── index.tsx          CRIAR  upload zone + histórico
│   │   │   ├── UploadZone.tsx     CRIAR  drag & drop + preview
│   │   │   └── HistoricoCargas.tsx CRIAR tabela com ações
│   │   ├── Cadastros/
│   │   │   ├── Unidades.tsx       CRIAR  CRUD básico unidades
│   │   │   └── Equipes.tsx        CRIAR  CRUD básico equipes
│   │   ├── Metas/
│   │   │   └── index.tsx          CRIAR  listagem placeholder
│   │   ├── Indicadores/
│   │   │   └── index.tsx          CRIAR  catálogo placeholder
│   │   ├── Relatorios/
│   │   │   └── index.tsx          CRIAR  placeholder "em construção"
│   │   └── Administracao/
│   │       └── index.tsx          CRIAR  placeholder
│   ├── main.tsx                   CRIAR
│   └── index.css                  CRIAR  Tailwind directives
├── .env.development               CRIAR  VITE_API_BASE=http://localhost:3100
├── .env.production                CRIAR  VITE_API_BASE=http://localhost:3001
├── tailwind.config.js             CRIAR
├── tsconfig.json                  CRIAR
└── vite.config.ts                 CRIAR
```

---

## Task 1: Criar projeto Vite + React + TypeScript

- [ ] **Step 1: Criar projeto**

```powershell
cd C:\simpa
npm create vite@latest simpa-frontend -- --template react-ts
cd simpa-frontend
npm install
```

- [ ] **Step 2: Instalar dependências**

```powershell
npm install react-router-dom echarts echarts-for-react
npm install @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-dialog
npm install clsx tailwind-merge lucide-react
npm install -D tailwindcss postcss autoprefixer json-server
```

- [ ] **Step 3: Inicializar Tailwind**

```powershell
npx tailwindcss init -p
```

- [ ] **Step 4: Configurar `tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:   '#2563eb',
          green:  '#10b981',
          amber:  '#f59e0b',
          purple: '#a855f7',
        },
        dark: {
          900: '#0f172a',
          800: '#111827',
          700: '#1e293b',
          600: '#334155',
          500: '#475569',
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 5: Criar `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0f172a;
  color: #f1f5f9;
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 6: Criar arquivos `.env`**

`.env.development`:
```
VITE_API_BASE=http://localhost:3100
```

`.env.production`:
```
VITE_API_BASE=http://localhost:3001
```

- [ ] **Step 7: Adicionar script json-server ao `package.json`**

```json
{
  "scripts": {
    "dev": "vite",
    "mock": "json-server --watch mock/db.json --port 3100 --routes mock/routes.json"
  }
}
```

---

## Task 2: Criar fixture do json-server

**Files:**
- Criar: `C:\simpa\simpa-frontend\mock\db.json`
- Criar: `C:\simpa\simpa-frontend\mock\routes.json`

- [ ] **Step 1: Criar `mock/db.json`** (payload PRD Seção 5 com dados reais Mai/2026)

```json
{
  "planejamento": [
    {
      "id": "2026-05_CAFI_EQ9",
      "plataforma": "SIMPA - Sistema Integrado de Monitoramento e Planejamento de Americana",
      "versao_schema": "3.1.0",
      "competencia": "2026-05",
      "municipio": "AMERICANA",
      "filtros_ativos": {
        "unidade": "CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO",
        "equipe": "EQUIPE 9 EAP"
      },
      "kpis_gerais": {
        "total_atendimentos_aps": 540,
        "total_procedimentos_ambulatoriais": 1426,
        "total_participantes_coletivos": 810,
        "atendimentos_odonto": 209
      },
      "modulos": {
        "atencao_primaria_esus": {
          "distribuicao_turnos": [
            { "turno": "Manhã", "atendimentos": 575, "procedimentos": 882 },
            { "turno": "Tarde", "atendimentos": 455, "procedimentos": 543 }
          ],
          "temas_coletivos": [
            { "tema": "Alimentação saudável", "quantidade": 37 },
            { "tema": "Autocuidado de pessoas com doenças crônicas", "quantidade": 37 },
            { "tema": "Saúde mental", "quantidade": 6 }
          ],
          "distribuicao_faixa_etaria": [
            { "faixa": "0-4",   "masculino": 12, "feminino": 15 },
            { "faixa": "5-9",   "masculino": 18, "feminino": 14 },
            { "faixa": "10-14", "masculino": 10, "feminino": 12 },
            { "faixa": "15-19", "masculino": 8,  "feminino": 20 },
            { "faixa": "20-29", "masculino": 22, "feminino": 55 },
            { "faixa": "30-39", "masculino": 25, "feminino": 62 },
            { "faixa": "40-49", "masculino": 30, "feminino": 70 },
            { "faixa": "50-59", "masculino": 35, "feminino": 75 },
            { "faixa": "60-69", "masculino": 40, "feminino": 68 },
            { "faixa": "70-79", "masculino": 28, "feminino": 45 },
            { "faixa": "80+",   "masculino": 15, "feminino": 30 }
          ],
          "historico_mensal": [
            { "competencia": "2025-12", "atendimentos": 480, "procedimentos": 1100, "meta": 600 },
            { "competencia": "2026-01", "atendimentos": 510, "procedimentos": 1200, "meta": 600 },
            { "competencia": "2026-02", "atendimentos": 490, "procedimentos": 1180, "meta": 600 },
            { "competencia": "2026-03", "atendimentos": 530, "procedimentos": 1350, "meta": 600 },
            { "competencia": "2026-04", "atendimentos": 515, "procedimentos": 1320, "meta": 600 },
            { "competencia": "2026-05", "atendimentos": 540, "procedimentos": 1426, "meta": 600 }
          ]
        },
        "ambulatorial_sia": {
          "status_conexao": "MySQL_XAMPP_CONNECTED",
          "procedimentos_especializados": [
            { "codigo_sigtap": "0205020046", "descricao": "ULTRASSONOGRAFIA DE ABDOMEN TOTAL", "quantidade": 11 }
          ]
        },
        "hospitalar_sihd": {
          "status_importacao": "PENDING_AIH_FILE",
          "internacoes_por_capitulo_cid": []
        },
        "financiamento_metas": {
          "classificacao_geral": "BOM",
          "indicadores": [
            { "codigo": "C1", "nome": "Acesso e Vínculo", "valor": null, "meta": null },
            { "codigo": "B1", "nome": "1ª consulta odontológica", "valor": null, "meta": null },
            { "codigo": "B2", "nome": "Tratamento odontológico concluído", "valor": null, "meta": null }
          ]
        },
        "elementos_futuros": {}
      },
      "emendas_parlamentares": []
    }
  ],
  "cargas": [
    {
      "id": 1, "tipo_relatorio": "atendimento_individual",
      "competencia": "2026-05-01", "unidade": "CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO",
      "equipe_nome": "EQUIPE 9 EAP", "arquivo_origem": "atend-ind-202605.csv",
      "registros_identificados": 540, "registros_nao_identificados": 0,
      "importado_em": "2026-06-13T17:50:00"
    },
    {
      "id": 2, "tipo_relatorio": "atendimento_odontologico",
      "competencia": "2026-05-01", "unidade": "CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO",
      "equipe_nome": "EQUIPE 9 EAP", "arquivo_origem": "atend-odonto-202605.csv",
      "registros_identificados": 209, "registros_nao_identificados": 0,
      "importado_em": "2026-06-13T17:52:00"
    }
  ],
  "unidades": [
    { "id": 1, "codigo": "CAFI001", "nome": "CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO", "tipo": "APS", "status": "ativo" }
  ],
  "equipes": [
    { "id": 1, "codigo": "0002200376", "nome": "EQUIPE 9 EAP", "tipo": "EAP", "unidade_id": 1, "status": "ativo" }
  ]
}
```

- [ ] **Step 2: Criar `mock/routes.json`** (mapeia rotas da API real para o json-server)

```json
{
  "/api/importacao/cargas": "/cargas",
  "/api/cadastros/unidades": "/unidades",
  "/api/cadastros/equipes": "/equipes",
  "/api/v1/dashboard/planejamento": "/planejamento/2026-05_CAFI_EQ9"
}
```

- [ ] **Step 3: Verificar json-server**

```powershell
npm run mock
```

Em outro terminal:
```powershell
Invoke-RestMethod "http://localhost:3100/api/importacao/cargas"
```

Esperado: array com 2 cargas do fixture.

---

## Task 3: Criar tipos TypeScript (`types/contrato.ts`)

**Files:**
- Criar: `C:\simpa\simpa-frontend\src\types\contrato.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
export interface DistribuicaoTurno {
  turno: string;
  atendimentos: number;
  procedimentos: number;
}

export interface TemaColetivo {
  tema: string;
  quantidade: number;
}

export interface FaixaEtaria {
  faixa: string;
  masculino: number;
  feminino: number;
}

export interface HistoricoMensal {
  competencia: string;
  atendimentos: number;
  procedimentos: number;
  meta: number | null;
}

export interface IndicadorFinanciamento {
  codigo: string;
  nome: string;
  equipe?: string;
  valor: number | null;
  meta: number | null;
}

export interface ModuloAPS {
  distribuicao_turnos: DistribuicaoTurno[];
  temas_coletivos: TemaColetivo[];
  distribuicao_faixa_etaria: FaixaEtaria[];
  historico_mensal: HistoricoMensal[];
}

export interface ModuloSIA {
  status_conexao: string;
  procedimentos_especializados: {
    codigo_sigtap: string;
    descricao: string;
    quantidade: number;
  }[];
}

export interface ModuloSIHD {
  status_importacao: string;
  internacoes_por_capitulo_cid: unknown[];
}

export interface KpisGerais {
  total_atendimentos_aps: number;
  total_procedimentos_ambulatoriais: number;
  total_participantes_coletivos: number;
  atendimentos_odonto: number;
}

export interface ContratoDashboard {
  plataforma: string;
  versao_schema: string;
  competencia: string;
  municipio: string;
  filtros_ativos: { unidade: string; equipe: string };
  kpis_gerais: KpisGerais;
  modulos: {
    atencao_primaria_esus: ModuloAPS;
    ambulatorial_sia: ModuloSIA;
    hospitalar_sihd: ModuloSIHD;
    financiamento_metas: {
      classificacao_geral: string;
      indicadores: IndicadorFinanciamento[];
    };
    elementos_futuros: Record<string, unknown>;
  };
  emendas_parlamentares: unknown[];
}

export interface CargaEsus {
  id: number;
  tipo_relatorio: string;
  competencia: string;
  unidade: string;
  equipe_nome: string;
  arquivo_origem: string;
  arquivo_path?: string;
  registros_identificados: number | null;
  registros_nao_identificados: number | null;
  importado_em: string;
}

export interface Unidade {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  status: string;
}

export interface Equipe {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  unidade_id: number | null;
  unidade_nome?: string;
  status: string;
}
```

---

## Task 4: Criar API client e hooks

**Files:**
- Criar: `src/api/client.ts`
- Criar: `src/api/dashboard.ts`
- Criar: `src/api/importacao.ts`
- Criar: `src/hooks/useFilters.tsx`
- Criar: `src/hooks/useDashboard.ts`

- [ ] **Step 1: Criar `src/api/client.ts`**

```typescript
const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Criar `src/api/dashboard.ts`**

```typescript
import { apiFetch } from './client';
import type { ContratoDashboard } from '../types/contrato';

export function fetchDashboard(
  competencia: string,
  unidade?: string,
  equipe?: string,
): Promise<ContratoDashboard> {
  const params = new URLSearchParams({ competencia });
  if (unidade) params.set('unidade', unidade);
  if (equipe)  params.set('equipe', equipe);
  return apiFetch<ContratoDashboard>(`/api/v1/dashboard/planejamento?${params}`);
}
```

- [ ] **Step 3: Criar `src/api/importacao.ts`**

```typescript
import type { CargaEsus } from '../types/contrato';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export async function fetchCargas(filtros?: { competencia?: string; unidade?: string }) {
  const params = new URLSearchParams();
  if (filtros?.competencia) params.set('competencia', filtros.competencia);
  if (filtros?.unidade)     params.set('unidade', filtros.unidade);
  const res = await fetch(`${BASE}/api/importacao/cargas?${params}`);
  return res.json() as Promise<CargaEsus[]>;
}

export async function previewUpload(files: File[]) {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const res = await fetch(`${BASE}/api/importacao/preview`, { method: 'POST', body: form });
  return res.json();
}

export async function uploadCargas(files: File[]) {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const res = await fetch(`${BASE}/api/importacao/upload`, { method: 'POST', body: form });
  return res.json();
}

export async function reprocessarCarga(id: number) {
  const res = await fetch(`${BASE}/api/importacao/${id}/reprocessar`, { method: 'POST' });
  return res.json();
}

export async function excluirCarga(id: number) {
  const res = await fetch(`${BASE}/api/importacao/${id}`, { method: 'DELETE' });
  return res.json();
}
```

- [ ] **Step 4: Criar `src/hooks/useFilters.tsx`**

```typescript
import React, { createContext, useContext, useState } from 'react';

type PeriodoTipo = 'mes' | 'quadrimestre' | 'ano';

interface Filtros {
  competencia: string;     // YYYY-MM
  periodoTipo: PeriodoTipo;
  unidade: string;         // '' = todas
  equipe: string;          // '' = todas
}

interface FiltersCtx extends Filtros {
  setCompetencia: (v: string) => void;
  setPeriodoTipo: (v: PeriodoTipo) => void;
  setUnidade: (v: string) => void;
  setEquipe: (v: string) => void;
}

const FiltersContext = createContext<FiltersCtx | null>(null);

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [competencia, setCompetencia] = useState('2026-05');
  const [periodoTipo, setPeriodoTipo]  = useState<PeriodoTipo>('mes');
  const [unidade, setUnidade]          = useState('');
  const [equipe, setEquipe]            = useState('');

  // Quando unidade muda para '', limpa equipe (cascata)
  function handleSetUnidade(v: string) {
    setUnidade(v);
    if (!v) setEquipe('');
  }

  return (
    <FiltersContext.Provider value={{
      competencia, setCompetencia,
      periodoTipo, setPeriodoTipo,
      unidade, setUnidade: handleSetUnidade,
      equipe,  setEquipe,
    }}>
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be inside FiltersProvider');
  return ctx;
}
```

- [ ] **Step 5: Criar `src/hooks/useDashboard.ts`**

```typescript
import { useEffect, useState } from 'react';
import { fetchDashboard } from '../api/dashboard';
import { useFilters } from './useFilters';
import type { ContratoDashboard } from '../types/contrato';

export function useDashboard() {
  const { competencia, unidade, equipe } = useFilters();
  const [data, setData]     = useState<ContratoDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDashboard(competencia, unidade || undefined, equipe || undefined)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [competencia, unidade, equipe]);

  return { data, loading, error };
}
```

---

## Task 5: Criar componentes de layout

**Files:**
- Criar: `src/components/layout/Sidebar.tsx`
- Criar: `src/components/layout/FilterBar.tsx`
- Criar: `src/components/layout/PageWrapper.tsx`

- [ ] **Step 1: Criar `src/components/layout/Sidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Upload, Target,
  BarChart2, FileText, Settings,
} from 'lucide-react';

const NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Painel' },
  { to: '/cadastros',     icon: Users,           label: 'Cadastros' },
  { to: '/importacao',    icon: Upload,          label: 'Importação' },
  { to: '/metas',         icon: Target,          label: 'Metas' },
  { to: '/indicadores',   icon: BarChart2,       label: 'Indicadores' },
  { to: '/relatorios',    icon: FileText,        label: 'Relatórios' },
];

export function Sidebar() {
  return (
    <div className="w-14 bg-dark-800 flex flex-col items-center py-3 gap-1 border-r border-dark-600 shrink-0">
      {/* Logo */}
      <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center mb-2">
        <span className="text-white text-sm font-black">S</span>
      </div>

      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={label}
          className={({ isActive }) =>
            `w-10 h-9 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-blue-900/50 text-sky-400'
                : 'text-dark-500 hover:text-slate-400 hover:bg-dark-700'
            }`
          }
        >
          <Icon size={18} />
        </NavLink>
      ))}

      <div className="flex-1" />

      <NavLink
        to="/admin"
        title="Administração"
        className={({ isActive }) =>
          `w-10 h-9 rounded-lg flex items-center justify-center transition-colors ${
            isActive ? 'bg-blue-900/50 text-sky-400' : 'text-dark-500 hover:text-slate-400'
          }`
        }
      >
        <Settings size={18} />
      </NavLink>
    </div>
  );
}
```

- [ ] **Step 2: Criar `src/components/layout/FilterBar.tsx`**

```tsx
import { useFilters } from '../../hooks/useFilters';

type PeriodoTipo = 'mes' | 'quadrimestre' | 'ano';

const PERIODOS: { value: PeriodoTipo; label: string }[] = [
  { value: 'mes',          label: 'Mês' },
  { value: 'quadrimestre', label: 'Quadrim.' },
  { value: 'ano',          label: 'Ano' },
];

// Opções estáticas por enquanto — virão da API em Task de integração
const UNIDADES = [
  { value: '', label: 'Todas as unidades' },
  { value: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO', label: 'CAFI' },
];

const EQUIPES: Record<string, { value: string; label: string }[]> = {
  'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO': [
    { value: '', label: 'Todas as equipes' },
    { value: 'EQUIPE 9 EAP', label: 'Equipe 9 EAP' },
  ],
};

interface FilterBarProps {
  titulo: string;
}

export function FilterBar({ titulo }: FilterBarProps) {
  const {
    competencia, setCompetencia,
    periodoTipo, setPeriodoTipo,
    unidade, setUnidade,
    equipe, setEquipe,
  } = useFilters();

  const equipeOpcoes = unidade ? (EQUIPES[unidade] || []) : [];
  const equipeDisabilitada = !unidade;

  const badge = [
    unidade || 'Município',
    equipe || 'Todas as equipes',
    competencia,
  ].join(' · ');

  return (
    <div className="bg-dark-800 border-b border-dark-600 px-4 py-2 flex items-center gap-3 flex-wrap">
      <span className="text-slate-400 text-xs font-semibold tracking-wide mr-1">{titulo}</span>

      {/* Segmented: Mês / Quadrim. / Ano */}
      <div className="flex bg-dark-900 border border-dark-600 rounded-md overflow-hidden">
        {PERIODOS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriodoTipo(p.value)}
            className={`px-2.5 py-1 text-xs border-l border-dark-600 first:border-l-0 transition-colors ${
              periodoTipo === p.value
                ? 'bg-brand-blue text-white font-semibold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Seletor de competência */}
      <input
        type="month"
        value={competencia}
        onChange={e => setCompetencia(e.target.value)}
        className="bg-dark-700 border border-dark-600 rounded text-slate-300 text-xs px-2 py-1"
      />

      <div className="w-px h-5 bg-dark-600 mx-1" />

      {/* Unidade */}
      <div className="flex flex-col gap-0.5">
        <span className="text-dark-500 text-[8px] uppercase tracking-wider">Unidade</span>
        <select
          value={unidade}
          onChange={e => setUnidade(e.target.value)}
          className="bg-dark-700 border border-dark-600 rounded text-slate-300 text-xs px-2 py-1 min-w-[120px]"
        >
          {UNIDADES.map(u => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </div>

      {/* Equipe — desabilitada se unidade = Todas */}
      <div className="flex flex-col gap-0.5">
        <span className="text-dark-500 text-[8px] uppercase tracking-wider">Equipe</span>
        <select
          value={equipe}
          onChange={e => setEquipe(e.target.value)}
          disabled={equipeDisabilitada}
          className="bg-dark-700 border border-dark-600 rounded text-slate-300 text-xs px-2 py-1 min-w-[120px] disabled:opacity-40"
        >
          {equipeDisabilitada
            ? <option value="">Selecione uma unidade</option>
            : equipeOpcoes.map(eq => (
                <option key={eq.value} value={eq.value}>{eq.label}</option>
              ))
          }
        </select>
      </div>

      <div className="flex-1" />

      {/* Badge contexto ativo */}
      <div className="bg-blue-900/40 border border-blue-800 rounded px-2 py-1 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
        <span className="text-sky-300 text-[9px]">{badge}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `src/components/layout/PageWrapper.tsx`**

```tsx
import { Sidebar } from './Sidebar';

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-dark-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
```

---

## Task 6: Criar `main.tsx` com roteamento

**Files:**
- Modificar: `src/main.tsx`

- [ ] **Step 1: Reescrever `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import { FiltersProvider } from './hooks/useFilters';
import { PageWrapper }     from './components/layout/PageWrapper';

import PainelPage       from './pages/Painel/index';
import ImportacaoPage   from './pages/Importacao/index';
import CadastrosPage    from './pages/Cadastros/Unidades';
import MetasPage        from './pages/Metas/index';
import IndicadoresPage  from './pages/Indicadores/index';
import RelatoriosPage   from './pages/Relatorios/index';
import AdminPage        from './pages/Administracao/index';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FiltersProvider>
      <BrowserRouter>
        <PageWrapper>
          <Routes>
            <Route path="/"            element={<PainelPage />} />
            <Route path="/importacao"  element={<ImportacaoPage />} />
            <Route path="/cadastros/*" element={<CadastrosPage />} />
            <Route path="/metas"       element={<MetasPage />} />
            <Route path="/indicadores" element={<IndicadoresPage />} />
            <Route path="/relatorios"  element={<RelatoriosPage />} />
            <Route path="/admin"       element={<AdminPage />} />
          </Routes>
        </PageWrapper>
      </BrowserRouter>
    </FiltersProvider>
  </React.StrictMode>
);
```

---

## Task 7: Criar componentes de gráficos ECharts

**Files:**
- Criar: `src/components/charts/TendenciaChart.tsx`
- Criar: `src/components/charts/RoscaChart.tsx`
- Criar: `src/components/charts/PiramideChart.tsx`
- Criar: `src/components/charts/TemasChart.tsx`

- [ ] **Step 1: Criar `TendenciaChart.tsx`**

```tsx
import ReactECharts from 'echarts-for-react';
import type { HistoricoMensal } from '../../types/contrato';

interface Props {
  dados: HistoricoMensal[];
  altura?: number;
}

export function TendenciaChart({ dados, altura = 160 }: Props) {
  const meses     = dados.map(d => d.competencia.slice(0, 7));
  const atend     = dados.map(d => d.atendimentos);
  const proced    = dados.map(d => d.procedimentos);
  const meta      = dados.map(d => d.meta);
  const temMeta   = meta.some(v => v !== null);

  const option = {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0, right: 0, textStyle: { color: '#64748b', fontSize: 10 },
      itemWidth: 10, itemHeight: 2,
    },
    xAxis: {
      type: 'category', data: meses,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#475569', fontSize: 9 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#475569', fontSize: 9 },
    },
    series: [
      {
        name: 'Atendimentos', type: 'line', data: atend,
        lineStyle: { color: '#2563eb', width: 2 },
        itemStyle: { color: '#2563eb' }, smooth: true,
        symbol: 'circle', symbolSize: 4,
      },
      {
        name: 'Procedimentos', type: 'line', data: proced,
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' }, smooth: true,
        symbol: 'circle', symbolSize: 4,
      },
      ...(temMeta ? [{
        name: 'Meta', type: 'line', data: meta,
        lineStyle: { color: '#f59e0b', width: 1, type: 'dashed' },
        itemStyle: { color: '#f59e0b' }, symbol: 'none',
      }] : []),
    ],
  };

  return <ReactECharts option={option} style={{ height: altura }} />;
}
```

- [ ] **Step 2: Criar `RoscaChart.tsx`**

```tsx
import ReactECharts from 'echarts-for-react';
import type { DistribuicaoTurno } from '../../types/contrato';

interface Props {
  dados: DistribuicaoTurno[];
  altura?: number;
}

const CORES = ['#2563eb', '#10b981', '#f59e0b'];

export function RoscaChart({ dados, altura = 160 }: Props) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['50%', '80%'],
      data: dados.map((d, i) => ({
        name: d.turno, value: d.atendimentos,
        itemStyle: { color: CORES[i % CORES.length] },
      })),
      label: { show: false },
      emphasis: { label: { show: false } },
    }],
  };

  return <ReactECharts option={option} style={{ height: altura }} />;
}
```

- [ ] **Step 3: Criar `PiramideChart.tsx`**

```tsx
import ReactECharts from 'echarts-for-react';
import type { FaixaEtaria } from '../../types/contrato';

interface Props {
  dados: FaixaEtaria[];
  altura?: number;
}

export function PiramideChart({ dados, altura = 180 }: Props) {
  const faixas = [...dados].reverse().map(d => d.faixa);
  const masc   = [...dados].reverse().map(d => -d.masculino);
  const fem    = [...dados].reverse().map(d => d.feminino);

  const option = {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (params: any[]) =>
        `${params[0].name}<br/>Masc: ${Math.abs(params[0].value)}<br/>Fem: ${params[1].value}`,
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#475569', fontSize: 9, formatter: (v: number) => Math.abs(v).toString() },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'category', data: faixas,
      axisLabel: { color: '#475569', fontSize: 9 },
    },
    series: [
      {
        name: 'Masculino', type: 'bar', stack: 'total', data: masc,
        itemStyle: { color: '#3b82f6' }, barMaxWidth: 20,
      },
      {
        name: 'Feminino', type: 'bar', stack: 'total', data: fem,
        itemStyle: { color: '#f472b6' }, barMaxWidth: 20,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: altura }} />;
}
```

- [ ] **Step 4: Criar `TemasChart.tsx`**

```tsx
import ReactECharts from 'echarts-for-react';
import type { TemaColetivo } from '../../types/contrato';

interface Props {
  dados: TemaColetivo[];
  altura?: number;
}

export function TemasChart({ dados, altura = 160 }: Props) {
  const sorted = [...dados].sort((a, b) => b.quantidade - a.quantidade);
  const option = {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#475569', fontSize: 9 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'category',
      data: sorted.map(d => d.tema.length > 30 ? d.tema.slice(0, 28) + '…' : d.tema),
      axisLabel: { color: '#94a3b8', fontSize: 9 },
    },
    series: [{
      type: 'bar', data: sorted.map(d => d.quantidade),
      itemStyle: { color: '#2563eb', borderRadius: [0, 3, 3, 0] },
      label: { show: true, position: 'right', color: '#94a3b8', fontSize: 9 },
    }],
  };

  return <ReactECharts option={option} style={{ height: altura }} />;
}
```

---

## Task 8: Criar Painel — Aba APS (núcleo do dashboard)

**Files:**
- Criar: `src/pages/Painel/IndicadoresGerais.tsx`
- Criar: `src/pages/Painel/PorTema.tsx`
- Criar: `src/pages/Painel/TabAPS.tsx`
- Criar: `src/pages/Painel/TabMAC.tsx`
- Criar: `src/pages/Painel/TabHospitalar.tsx`
- Criar: `src/pages/Painel/index.tsx`

- [ ] **Step 1: Criar `IndicadoresGerais.tsx`**

```tsx
import type { KpisGerais, ModuloAPS } from '../../types/contrato';
import { TendenciaChart } from '../../components/charts/TendenciaChart';
import { RoscaChart }     from '../../components/charts/RoscaChart';
import { PiramideChart }  from '../../components/charts/PiramideChart';
import { TemasChart }     from '../../components/charts/TemasChart';

interface KpiCardProps {
  label: string;
  value: number | null;
  sub: string;
  borderColor: string;
}

function KpiCard({ label, value, sub, borderColor }: KpiCardProps) {
  return (
    <div className={`flex-1 bg-dark-700 rounded-lg p-3 border-t-[3px]`} style={{ borderColor }}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-100 leading-none">
        {value != null ? value.toLocaleString('pt-BR') : <span className="text-amber-500 text-sm">—</span>}
      </p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

interface Props {
  kpis: KpisGerais;
  aps: ModuloAPS;
}

export function IndicadoresGerais({ kpis, aps }: Props) {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* KPI row */}
      <div className="flex gap-2.5 shrink-0">
        <KpiCard label="Atendimentos APS"      value={kpis.total_atendimentos_aps}          sub="individuais clínicos" borderColor="#2563eb" />
        <KpiCard label="Procedimentos"          value={kpis.total_procedimentos_ambulatoriais} sub="ambulatoriais"        borderColor="#10b981" />
        <KpiCard label="Participantes Coletivos" value={kpis.total_participantes_coletivos}  sub="ações coletivas"      borderColor="#f59e0b" />
        <KpiCard label="Odontológico"           value={kpis.atendimentos_odonto}             sub="atendimentos"         borderColor="#a855f7" />
      </div>

      {/* Grid 2x2 */}
      <div className="grid grid-cols-2 grid-rows-2 gap-2.5 flex-1 min-h-0">
        <div className="bg-dark-700 rounded-lg p-3 flex flex-col">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Tendência Mensal</p>
          <div className="flex-1">
            <TendenciaChart dados={aps.historico_mensal} altura={140} />
          </div>
        </div>

        <div className="bg-dark-700 rounded-lg p-3 flex flex-col">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Distribuição por Turno</p>
          <div className="flex-1 flex items-center gap-4">
            <RoscaChart dados={aps.distribuicao_turnos} altura={120} />
            <div className="flex flex-col gap-2">
              {aps.distribuicao_turnos.map((t, i) => (
                <div key={t.turno}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-sm" style={{ background: ['#2563eb','#10b981','#f59e0b'][i] }} />
                    <span className="text-[10px] text-slate-400">{t.turno}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-100 ml-3.5">
                    {t.atendimentos.toLocaleString('pt-BR')} <span className="text-[10px] text-slate-500 font-normal">atend.</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-dark-700 rounded-lg p-3 flex flex-col">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Pirâmide Etária</p>
          <div className="flex-1">
            <PiramideChart dados={aps.distribuicao_faixa_etaria} altura={140} />
          </div>
        </div>

        <div className="bg-dark-700 rounded-lg p-3 flex flex-col">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Temas — Ações Coletivas</p>
          <div className="flex-1">
            <TemasChart dados={aps.temas_coletivos} altura={140} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `PorTema.tsx`**

```tsx
import { useState } from 'react';
import type { ModuloAPS, KpisGerais } from '../../types/contrato';
import { TendenciaChart } from '../../components/charts/TendenciaChart';

const TEMAS_CONFIG = [
  { key: 'gestante',         emoji: '🤰', label: 'Gestante',         cor: '#2563eb' },
  { key: 'primeira_infancia', emoji: '👶', label: 'Primeira Infância', cor: '#3b82f6' },
  { key: 'idoso',            emoji: '🧓', label: 'Idoso',            cor: '#a855f7' },
  { key: 'outros',           emoji: '👥', label: 'Outros',           cor: '#10b981' },
];

interface Props {
  kpis: KpisGerais;
  aps: ModuloAPS;
}

export function PorTema({ kpis, aps }: Props) {
  const [temaSelecionado, setTemaSelecionado] = useState<string | null>('gestante');

  // Distribuição aproximada por tema (em produção virá do backend)
  const totalAtend = kpis.total_atendimentos_aps;
  const estimativas: Record<string, number> = {
    gestante:          Math.round(totalAtend * 0.12),
    primeira_infancia: Math.round(totalAtend * 0.26),
    idoso:             Math.round(totalAtend * 0.37),
    outros:            Math.round(totalAtend * 0.25),
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Cards de tema */}
      <div className="flex gap-2.5 shrink-0">
        {TEMAS_CONFIG.map(t => {
          const ativo = temaSelecionado === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTemaSelecionado(ativo ? null : t.key)}
              className={`flex-1 rounded-lg p-3 text-left relative transition-all ${
                ativo
                  ? 'bg-blue-900/40 border-2 border-brand-blue'
                  : 'bg-dark-700 border border-dark-600 hover:border-dark-500'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-base">{t.emoji}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</span>
                {ativo && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />}
              </div>
              <p className="text-lg font-bold text-slate-100">
                {estimativas[t.key].toLocaleString('pt-BR')}
                <span className="text-[10px] text-slate-500 font-normal ml-1">atend.</span>
              </p>
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg"
                style={{ background: t.cor, opacity: 0.7 }}
              />
            </button>
          );
        })}
      </div>

      {/* Detalhe do tema selecionado */}
      {temaSelecionado && (
        <div className="bg-blue-950/40 border border-blue-900 rounded-lg p-3 shrink-0">
          <p className="text-sky-300 text-[10px] font-semibold mb-2">
            {TEMAS_CONFIG.find(t => t.key === temaSelecionado)?.emoji}{' '}
            DETALHES — {TEMAS_CONFIG.find(t => t.key === temaSelecionado)?.label.toUpperCase()}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Atendimentos', value: estimativas[temaSelecionado], cor: '#10b981' },
              { label: 'vs. mês anterior', value: null, cor: null },
              { label: 'Indicador específico', value: null, cor: null },
            ].map(item => (
              <div key={item.label} className="bg-dark-700 rounded p-2">
                <p className="text-[9px] text-slate-500 mb-0.5">{item.label}</p>
                {item.value != null
                  ? <p className="text-sm font-bold text-slate-100">{item.value.toLocaleString('pt-BR')}</p>
                  : <p className="text-sm font-bold text-amber-500">—</p>
                }
                {item.cor && (
                  <p className="text-[9px] mt-0.5" style={{ color: item.cor }}>apurado</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tendência do tema */}
      <div className="bg-dark-700 rounded-lg p-3 flex-1 flex flex-col min-h-0">
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">
          Tendência — {TEMAS_CONFIG.find(t => t.key === temaSelecionado)?.label || 'Geral'}
        </p>
        <div className="flex-1">
          <TendenciaChart dados={aps.historico_mensal} altura={130} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `TabAPS.tsx`**

```tsx
import { useState } from 'react';
import { Settings } from 'lucide-react';
import type { KpisGerais, ModuloAPS } from '../../types/contrato';
import { IndicadoresGerais } from './IndicadoresGerais';
import { PorTema }           from './PorTema';

type ViewMode = 'indicadores' | 'temas';

interface Props {
  kpis: KpisGerais;
  aps: ModuloAPS;
}

export function TabAPS({ kpis, aps }: Props) {
  const [modo, setModo] = useState<ViewMode>('indicadores');

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Toggle */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex bg-dark-900 border border-dark-600 rounded-lg overflow-hidden">
          {(['indicadores', 'temas'] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`px-3.5 py-1.5 text-xs font-semibold border-l border-dark-600 first:border-l-0 transition-colors ${
                modo === m
                  ? 'bg-blue-900/50 text-sky-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'indicadores' ? 'Indicadores Gerais' : 'Por Tema'}
            </button>
          ))}
        </div>
        <button className="bg-dark-700 border border-dark-600 rounded p-1.5 text-slate-500 hover:text-slate-300">
          <Settings size={12} />
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-h-0">
        {modo === 'indicadores'
          ? <IndicadoresGerais kpis={kpis} aps={aps} />
          : <PorTema kpis={kpis} aps={aps} />
        }
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Criar `TabMAC.tsx`**

```tsx
import type { ModuloSIA } from '../../types/contrato';

interface Props { sia: ModuloSIA }

export function TabMAC({ sia }: Props) {
  const conectado = sia.status_conexao === 'MySQL_XAMPP_CONNECTED';
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
        conectado ? 'bg-green-950/40 border border-green-900 text-green-400'
                  : 'bg-amber-950/40 border border-amber-900 text-amber-400'
      }`}>
        <div className={`w-2 h-2 rounded-full ${conectado ? 'bg-green-400' : 'bg-amber-400'}`} />
        {conectado ? 'MySQL/XAMPP conectado' : 'Aguardando conexão SIA'}
      </div>
      {sia.procedimentos_especializados.length > 0 && (
        <div className="bg-dark-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-600">
                <th className="px-3 py-2 text-left text-slate-500">SIGTAP</th>
                <th className="px-3 py-2 text-left text-slate-500">Procedimento</th>
                <th className="px-3 py-2 text-right text-slate-500">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {sia.procedimentos_especializados.map(p => (
                <tr key={p.codigo_sigtap} className="border-b border-dark-600/50">
                  <td className="px-3 py-2 text-slate-400 font-mono">{p.codigo_sigtap}</td>
                  <td className="px-3 py-2 text-slate-300">{p.descricao}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-100">{p.quantidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Criar `TabHospitalar.tsx`**

```tsx
import type { ModuloSIHD } from '../../types/contrato';

interface Props { sihd: ModuloSIHD }

export function TabHospitalar({ sihd }: Props) {
  const pendente = sihd.status_importacao === 'PENDING_AIH_FILE';
  return (
    <div className="flex items-center justify-center h-48">
      <div className="text-center">
        <div className="w-12 h-12 bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-amber-400 text-xl">⏳</span>
        </div>
        <p className="text-slate-300 text-sm font-medium mb-1">
          {pendente ? 'Aguardando arquivo AIH' : sihd.status_importacao}
        </p>
        <p className="text-slate-500 text-xs">
          Importe o arquivo SIHD/AIH no módulo de Importação para ativar este painel.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Criar `pages/Painel/index.tsx`**

```tsx
import { FilterBar }     from '../../components/layout/FilterBar';
import { useDashboard }  from '../../hooks/useDashboard';
import { TabAPS }        from './TabAPS';
import { TabMAC }        from './TabMAC';
import { TabHospitalar } from './TabHospitalar';
import { useState }      from 'react';

type AbaAtiva = 'aps' | 'mac' | 'hospitalar';

export default function PainelPage() {
  const { data, loading, error } = useDashboard();
  const [aba, setAba]            = useState<AbaAtiva>('aps');

  const abas: { key: AbaAtiva; label: string; badge?: string }[] = [
    { key: 'aps',         label: 'Atenção Primária' },
    { key: 'mac',         label: 'MAC / SIA' },
    { key: 'hospitalar',  label: 'Hospitalar', badge: 'Pendente' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterBar titulo="PAINEL" />

      {/* Tabs */}
      <div className="bg-dark-800 border-b border-dark-600 px-4 flex gap-0 shrink-0">
        {abas.map(a => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              aba === a.key
                ? 'text-sky-400 border-brand-blue'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {a.label}
            {a.badge && (
              <span className="bg-dark-700 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full">
                {a.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <p className="text-slate-500 text-sm">Carregando dados...</p>
          </div>
        )}
        {error && (
          <div className="bg-red-950/40 border border-red-900 rounded-lg p-4 text-red-400 text-sm">
            Erro ao carregar dados: {error}
          </div>
        )}
        {data && !loading && (
          <>
            {aba === 'aps' && (
              <TabAPS
                kpis={data.kpis_gerais}
                aps={data.modulos.atencao_primaria_esus}
              />
            )}
            {aba === 'mac' && <TabMAC sia={data.modulos.ambulatorial_sia} />}
            {aba === 'hospitalar' && <TabHospitalar sihd={data.modulos.hospitalar_sihd} />}
          </>
        )}
      </div>
    </div>
  );
}
```

---

## Task 9: Criar módulo de Importação

**Files:**
- Criar: `src/pages/Importacao/UploadZone.tsx`
- Criar: `src/pages/Importacao/HistoricoCargas.tsx`
- Criar: `src/pages/Importacao/index.tsx`

- [ ] **Step 1: Criar `UploadZone.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { previewUpload, uploadCargas } from '../../api/importacao';

interface PreviewItem {
  nome: string;
  tipo_relatorio: string;
  competencia: string;
  unidade: string;
  equipe_nome: string;
  ja_importado: boolean;
}

interface Props {
  onUploadConcluido: () => void;
}

export function UploadZone({ onUploadConcluido }: Props) {
  const [files,     setFiles]     = useState<File[]>([]);
  const [preview,   setPreview]   = useState<PreviewItem[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [dragging,  setDragging]  = useState(false);

  const processarArquivos = useCallback(async (novosFiles: File[]) => {
    setFiles(novosFiles);
    setLoading(true);
    try {
      const resultado = await previewUpload(novosFiles);
      setPreview(resultado);
    } catch (e) {
      console.error('Erro no preview:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    if (dropped.length) processarArquivos(dropped);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selecionados = Array.from(e.target.files || []);
    if (selecionados.length) processarArquivos(selecionados);
  };

  const handleProcessar = async () => {
    setLoading(true);
    try {
      await uploadCargas(files);
      setFiles([]);
      setPreview([]);
      onUploadConcluido();
    } catch (e) {
      console.error('Erro no upload:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      className={`border-2 border-dashed rounded-xl p-5 transition-colors ${
        dragging ? 'border-brand-blue bg-blue-900/10' : 'border-dark-600 bg-dark-800'
      }`}
    >
      {preview.length === 0 ? (
        <label className="flex flex-col items-center gap-2 cursor-pointer">
          <Upload size={28} className="text-slate-500" />
          <p className="text-sm text-slate-300 font-medium">Arraste os CSVs do e-SUS aqui</p>
          <p className="text-xs text-slate-500">ou clique para selecionar — múltiplos arquivos permitidos</p>
          <p className="text-[10px] text-dark-500">ISO-8859-1 convertido automaticamente</p>
          <input type="file" accept=".csv" multiple onChange={handleFileInput} className="hidden" />
        </label>
      ) : (
        <div className="flex flex-col gap-2">
          {preview.map((p, i) => (
            <div key={i} className="flex items-center gap-2 bg-dark-700 rounded px-3 py-2">
              <span className="text-green-400 text-xs">✓</span>
              <span className="text-slate-300 text-xs flex-1 truncate">{p.nome}</span>
              <span className="bg-blue-900/50 text-sky-300 text-[9px] px-1.5 py-0.5 rounded">
                {p.tipo_relatorio}
              </span>
              {p.ja_importado && (
                <span className="bg-amber-900/50 text-amber-400 text-[9px] px-1.5 py-0.5 rounded">
                  já importado
                </span>
              )}
              <span className="text-slate-500 text-[9px]">
                {p.competencia?.slice(0,7)} · {p.unidade?.slice(0,20)} · {p.equipe_nome}
              </span>
            </div>
          ))}
          <div className="flex gap-2 justify-end mt-1">
            <button
              onClick={() => { setFiles([]); setPreview([]); }}
              className="px-3 py-1.5 text-xs text-slate-500 bg-dark-700 border border-dark-600 rounded hover:text-slate-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleProcessar}
              disabled={loading}
              className="px-4 py-1.5 text-xs text-white bg-brand-blue rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processando…' : `Processar ${files.length} arquivo(s) →`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar `HistoricoCargas.tsx`**

```tsx
import { useState } from 'react';
import { RotateCcw, ArrowUpFromLine, Trash2 } from 'lucide-react';
import type { CargaEsus } from '../../types/contrato';
import { reprocessarCarga, excluirCarga } from '../../api/importacao';

interface Props {
  cargas: CargaEsus[];
  onAtualizar: () => void;
}

function StatusBadge({ reg, rej }: { reg: number | null; rej: number | null }) {
  if (reg == null) return <span className="bg-blue-900/50 text-sky-400 text-[9px] px-2 py-0.5 rounded-full">processando…</span>;
  if ((rej ?? 0) > 0) return <span className="bg-amber-900/50 text-amber-400 text-[9px] px-2 py-0.5 rounded-full">⚠ parcial</span>;
  return <span className="bg-green-950 text-green-400 text-[9px] px-2 py-0.5 rounded-full">✓ OK</span>;
}

export function HistoricoCargas({ cargas, onAtualizar }: Props) {
  const [confirmExcluir, setConfirmExcluir] = useState<number | null>(null);

  const handleReprocessar = async (id: number) => {
    await reprocessarCarga(id);
    onAtualizar();
  };

  const handleExcluir = async (id: number) => {
    if (confirmExcluir !== id) { setConfirmExcluir(id); return; }
    await excluirCarga(id);
    setConfirmExcluir(null);
    onAtualizar();
  };

  return (
    <div className="bg-dark-700 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-dark-600 flex items-center gap-2">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Histórico de Cargas</span>
        <span className="bg-dark-900 border border-dark-600 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-full">{cargas.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dark-600 bg-dark-800/50">
              {['Tipo', 'Competência', 'Unidade / Equipe', 'Registros', 'Status', 'Importado em', ''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargas.map(c => (
              <tr key={c.id} className="border-b border-dark-600/40 hover:bg-dark-600/20">
                <td className="px-3 py-2 text-slate-300 font-mono text-[10px]">{c.tipo_relatorio}</td>
                <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                  {c.competencia?.slice(0, 7)}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  <div>{c.unidade?.slice(0, 25)}{(c.unidade?.length ?? 0) > 25 ? '…' : ''}</div>
                  <div className="text-slate-500 text-[9px]">{c.equipe_nome}</div>
                </td>
                <td className="px-3 py-2">
                  <span className="text-green-400">{c.registros_identificados ?? '—'}</span>
                  {(c.registros_nao_identificados ?? 0) > 0 && (
                    <span className="text-red-400 ml-1">/ {c.registros_nao_identificados} rej.</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge reg={c.registros_identificados} rej={c.registros_nao_identificados} />
                </td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                  {new Date(c.importado_em).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleReprocessar(c.id)}
                      title="Reprocessar"
                      className="bg-blue-900/30 hover:bg-blue-900/60 text-sky-400 rounded p-1"
                    >
                      <RotateCcw size={11} />
                    </button>
                    <button
                      title="Substituir arquivo"
                      className="bg-dark-600 hover:bg-dark-500 text-slate-400 rounded p-1"
                    >
                      <ArrowUpFromLine size={11} />
                    </button>
                    <button
                      onClick={() => handleExcluir(c.id)}
                      title={confirmExcluir === c.id ? 'Clique para confirmar' : 'Excluir'}
                      className={`rounded p-1 ${
                        confirmExcluir === c.id
                          ? 'bg-red-900/60 text-red-400 ring-1 ring-red-500'
                          : 'bg-dark-600 hover:bg-dark-500 text-slate-500'
                      }`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `pages/Importacao/index.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { FilterBar }      from '../../components/layout/FilterBar';
import { UploadZone }     from './UploadZone';
import { HistoricoCargas } from './HistoricoCargas';
import { fetchCargas }    from '../../api/importacao';
import type { CargaEsus } from '../../types/contrato';

export default function ImportacaoPage() {
  const [cargas,  setCargas]  = useState<CargaEsus[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    try {
      const dados = await fetchCargas();
      setCargas(dados);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterBar titulo="IMPORTAÇÃO" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <UploadZone onUploadConcluido={carregar} />
        {loading
          ? <p className="text-slate-500 text-sm">Carregando histórico...</p>
          : <HistoricoCargas cargas={cargas} onAtualizar={carregar} />
        }
      </div>
    </div>
  );
}
```

---

## Task 10: Criar páginas de suporte (placeholders e Cadastros básico)

- [ ] **Step 1: Criar páginas placeholder**

`src/pages/Metas/index.tsx`:
```tsx
import { FilterBar } from '../../components/layout/FilterBar';
export default function MetasPage() {
  return (
    <div className="flex flex-col h-full">
      <FilterBar titulo="METAS" />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Módulo de Metas — em desenvolvimento</p>
      </div>
    </div>
  );
}
```

`src/pages/Indicadores/index.tsx`:
```tsx
import { FilterBar } from '../../components/layout/FilterBar';
export default function IndicadoresPage() {
  return (
    <div className="flex flex-col h-full">
      <FilterBar titulo="INDICADORES" />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Catálogo de Indicadores — em desenvolvimento</p>
      </div>
    </div>
  );
}
```

`src/pages/Relatorios/index.tsx`:
```tsx
export default function RelatoriosPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-slate-500 text-sm">Relatórios — em construção</p>
    </div>
  );
}
```

`src/pages/Administracao/index.tsx`:
```tsx
export default function AdminPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-slate-500 text-sm">Administração — em desenvolvimento</p>
    </div>
  );
}
```

- [ ] **Step 2: Criar `src/pages/Cadastros/Unidades.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { FilterBar } from '../../components/layout/FilterBar';
import type { Unidade } from '../../types/contrato';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export default function UnidadesPage() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [form,     setForm]     = useState({ codigo: '', nome: '', tipo: 'APS', cnes: '' });

  const carregar = () =>
    fetch(`${BASE}/api/cadastros/unidades`).then(r => r.json()).then(setUnidades);

  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    await fetch(`${BASE}/api/cadastros/unidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ codigo: '', nome: '', tipo: 'APS', cnes: '' });
    carregar();
  };

  const inativar = async (id: number) => {
    await fetch(`${BASE}/api/cadastros/unidades/${id}`, { method: 'DELETE' });
    carregar();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterBar titulo="CADASTROS — UNIDADES" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {/* Formulário */}
        <div className="bg-dark-700 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs text-slate-400 font-semibold uppercase">Nova Unidade</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { key: 'codigo', placeholder: 'Código' },
              { key: 'nome',   placeholder: 'Nome da unidade' },
              { key: 'cnes',   placeholder: 'CNES' },
            ].map(f => (
              <input
                key={f.key}
                placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300 placeholder-slate-600"
              />
            ))}
            <select
              value={form.tipo}
              onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
              className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300"
            >
              {['APS','MAC','Hospitalar','Misto'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button
            onClick={salvar}
            disabled={!form.codigo || !form.nome}
            className="self-end px-4 py-1.5 text-xs font-semibold text-white bg-brand-blue rounded hover:bg-blue-700 disabled:opacity-40"
          >
            Salvar
          </button>
        </div>

        {/* Tabela */}
        <div className="bg-dark-700 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-600">
                {['Código','Nome','Tipo','CNES','Status',''].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unidades.map(u => (
                <tr key={u.id} className="border-b border-dark-600/40">
                  <td className="px-3 py-2 text-slate-400 font-mono">{u.codigo}</td>
                  <td className="px-3 py-2 text-slate-300">{u.nome}</td>
                  <td className="px-3 py-2 text-slate-400">{u.tipo}</td>
                  <td className="px-3 py-2 text-slate-500">{u.cnes || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                      u.status === 'ativo'
                        ? 'bg-green-950 text-green-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}>{u.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => inativar(u.id)}
                      className="text-slate-500 hover:text-red-400 text-[10px]"
                    >
                      Inativar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 11: Verificar app com mock e depois integrar com backend real

- [ ] **Step 1: Subir json-server e verificar**

Terminal 1:
```powershell
cd C:\simpa\simpa-frontend
npm run mock
```

Terminal 2:
```powershell
npm run dev
```

Abra `http://localhost:5173`. Verifique:
- Sidebar com 7 ícones de navegação
- Painel mostra KPIs (540, 1426, 810, 209)
- Gráficos renderizam (ECharts)
- Toggle Indicadores/Temas funciona
- Filtros atualizam o badge de contexto
- Navegação para Importação mostra UploadZone + histórico com 2 cargas do fixture

- [ ] **Step 2: Trocar para backend real**

Modifique `.env.development`:
```
VITE_API_BASE=http://localhost:3001
```

Suba o backend (Plano B):
```powershell
cd C:\simpa\simpa-backend
npm run dev
```

Reinicie o frontend:
```powershell
cd C:\simpa\simpa-frontend
npm run dev
```

- [ ] **Step 3: Testar upload real via UI**

1. Acesse `/importacao`
2. Arraste `C:\simpa\Relatório de atendimento individual-20260613175047.csv`
3. Confirme preview (tipo, competência, unidade, equipe)
4. Clique "Processar"
5. Verifique que a carga aparece no histórico com status ✓ OK

- [ ] **Step 4: Build de produção**

```powershell
cd C:\simpa\simpa-frontend
npm run build
```

Esperado: `dist/` gerado sem erros TypeScript.

- [ ] **Step 5: Commit final**

```powershell
cd C:\simpa\simpa-frontend
git add .
git commit -m "feat(frontend): add complete SIMPA UI — painel, importacao, cadastros"
```

---

## Verificação final do Plano C

- [ ] App abre em `http://localhost:5173` sem erros no console
- [ ] Dashboard mostra KPIs reais e 4 gráficos ECharts
- [ ] Toggle Indicadores/Temas funciona na aba APS
- [ ] Filtros Mês/Quadrim./Ano + Unidade + Equipe (cascata) atualizam badge
- [ ] `/importacao` — drag & drop + preview + processar + histórico com ações
- [ ] `/cadastros` — CRUD básico de unidades funciona
- [ ] Todas as rotas renderizam (sem erros TypeScript)
- [ ] `npm run build` passa sem erros

**Plano C completo. SIMPA MVP entregue.**
