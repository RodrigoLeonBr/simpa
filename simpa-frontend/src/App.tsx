import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import PainelPage from './pages/Painel';
import ImportacaoPage from './pages/Importacao';
import CadastrosPage from './pages/Cadastros';
import MetasPage from './pages/Metas';
import IndicadoresPage from './pages/Indicadores';
import RelatoriosPage from './pages/Relatorios';
import AdminPage from './pages/Administracao';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<PainelPage />} />
          <Route path="/importacao" element={<ImportacaoPage />} />
          <Route path="/cadastros/*" element={<CadastrosPage />} />
          <Route path="/metas" element={<MetasPage />} />
          <Route path="/indicadores" element={<IndicadoresPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
