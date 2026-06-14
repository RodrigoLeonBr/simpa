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
