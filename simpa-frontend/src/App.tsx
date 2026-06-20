import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { FiltersProvider } from './hooks/useFilters';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './pages/Login';
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
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <AppProvider>
                  <FiltersProvider>
                    <AppShell />
                  </FiltersProvider>
                </AppProvider>
              }
            >
              <Route path="/" element={<PainelPage />} />
              <Route path="/importacao" element={<ImportacaoPage />} />
              <Route path="/cadastros/*" element={<CadastrosPage />} />
              <Route path="/metas" element={<MetasPage />} />
              <Route path="/indicadores" element={<IndicadoresPage />} />
              <Route path="/relatorios" element={<RelatoriosPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
