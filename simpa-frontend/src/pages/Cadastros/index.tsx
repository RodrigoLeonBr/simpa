import { Navigate, Route, Routes } from 'react-router-dom';
import { CadastroCrudPage } from '../../components/cadastros/CadastroCrudPage';
import { CADASTRO_ENTITIES } from '../../config/cadastroEntities';
import { CadastroGrid } from './CadastroGrid';
import { CbosPage } from './CbosPage';
import { EstabelecimentosPage } from './EstabelecimentosPage';
import { FormasPage } from './FormasPage';
import { IndicadoresPainelPage } from './IndicadoresPainelPage';
import { MetasOciParPage } from './MetasOciParPage';
import { ProcedimentosPage } from './ProcedimentosPage';

export default function CadastrosPage() {
  return (
    <Routes>
      <Route index element={<CadastroGrid />} />
      <Route path="estabelecimentos" element={<EstabelecimentosPage />} />
      <Route path="procedimentos" element={<ProcedimentosPage />} />
      <Route path="formas" element={<FormasPage />} />
      <Route path="cbos" element={<CbosPage />} />
      <Route path="indicadores-painel" element={<IndicadoresPainelPage />} />
      <Route path="metas-oci-par" element={<MetasOciParPage />} />
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
