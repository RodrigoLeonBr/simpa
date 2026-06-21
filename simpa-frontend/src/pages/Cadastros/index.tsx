import { Navigate, Route, Routes } from 'react-router-dom';
import { CadastroCrudPage } from '../../components/cadastros/CadastroCrudPage';
import { CADASTRO_ENTITIES } from '../../config/cadastroEntities';
import { CadastroGrid } from './CadastroGrid';
import { EstabelecimentosPage } from './EstabelecimentosPage';
import { ProcedimentosPage } from './ProcedimentosPage';
import { IndicadoresPainelPage } from './IndicadoresPainelPage';

export default function CadastrosPage() {
  return (
    <Routes>
      <Route index element={<CadastroGrid />} />
      <Route path="estabelecimentos" element={<EstabelecimentosPage />} />
      <Route path="procedimentos" element={<ProcedimentosPage />} />
      <Route path="indicadores-painel" element={<IndicadoresPainelPage />} />
      {CADASTRO_ENTITIES.map((entity) => (
        <Route
          key={entity.key}
          path={entity.route}
          element={<CadastroCrudPage config={entity} />}
        />
      ))}
      <Route path="*" element={<Navigate to="/cadastros" replace />} />
    </Routes>
  );
}
