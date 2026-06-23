import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { FiltersProvider } from './hooks/useFilters';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { LazyModuleRoute } from './components/shared/ModuleLoadError';
import LoginPage from './pages/Login';
import PainelPage from './pages/Painel';

const CadastrosPage = lazy(() => import('./pages/Cadastros'));
const PopulacaoPage = lazy(() => import('./pages/Painel/PopulacaoPage'));
const ImportacaoPage = lazy(() => import('./pages/Importacao'));
const AdminPage = lazy(() => import('./pages/Administracao'));
const MetasPage = lazy(() => import('./pages/Metas'));
const IndicadoresPage = lazy(() => import('./pages/Indicadores'));
const RelatoriosPage = lazy(() => import('./pages/Relatorios'));

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
              <Route path="/importacao" element={<LazyModuleRoute Page={ImportacaoPage} />} />
              <Route path="/cadastros/*" element={<LazyModuleRoute Page={CadastrosPage} />} />
              <Route path="/metas" element={<LazyModuleRoute Page={MetasPage} />} />
              <Route path="/indicadores" element={<LazyModuleRoute Page={IndicadoresPage} />} />
              <Route path="/relatorios" element={<LazyModuleRoute Page={RelatoriosPage} />} />
              <Route path="/painel/populacao" element={<LazyModuleRoute Page={PopulacaoPage} />} />
              <Route path="/admin/*" element={<LazyModuleRoute Page={AdminPage} />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
