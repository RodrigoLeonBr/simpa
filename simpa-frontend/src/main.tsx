import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import { FiltersProvider } from './hooks/useFilters';
import { PageWrapper }     from './components/layout/PageWrapper';

import PainelPage         from './pages/Painel/index';
import ImportacaoPage     from './pages/Importacao/index';
import CadastrosLayout    from './pages/Cadastros/index';
import UnidadesPage       from './pages/Cadastros/Unidades';
import ProcedimentosPage  from './pages/Cadastros/Procedimentos';
import MetasPage          from './pages/Metas/index';
import IndicadoresPage    from './pages/Indicadores/index';
import RelatoriosPage     from './pages/Relatorios/index';
import AdminPage          from './pages/Administracao/index';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FiltersProvider>
      <BrowserRouter>
        <PageWrapper>
          <Routes>
            <Route path="/"            element={<PainelPage />} />
            <Route path="/importacao"  element={<ImportacaoPage />} />
            <Route path="/cadastros"   element={<CadastrosLayout />}>
              <Route index element={<UnidadesPage />} />
              <Route path="procedimentos" element={<ProcedimentosPage />} />
              <Route path="*" element={<Navigate to="/cadastros" replace />} />
            </Route>
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
