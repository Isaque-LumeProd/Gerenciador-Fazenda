import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Painel from './pages/Painel';
import Rebanho from './pages/bovinos/Rebanho';
import AnimalDetalhe from './pages/bovinos/AnimalDetalhe';
import Pesagens from './pages/bovinos/Pesagens';
import Reproducao from './pages/bovinos/Reproducao';
import Leite from './pages/bovinos/Leite';
import LotesAves from './pages/aves/LotesAves';
import LoteDetalhe from './pages/aves/LoteDetalhe';
import ProducaoAves from './pages/aves/ProducaoAves';
import Sanidade from './pages/Sanidade';
import Pastagens from './pages/Pastagens';
import Estoque from './pages/Estoque';
import Financeiro from './pages/Financeiro';
import Agenda from './pages/Agenda';
import Equipe from './pages/Equipe';
import Configuracoes from './pages/Configuracoes';
import { Vazio } from './components/ui';
import Entrar from './pages/Entrar';
import { useSync } from './sync/motor';

export default function App() {
  const temSessao = useSync((s) => s.sessao !== null);
  if (!temSessao) return <Entrar />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Painel />} />
        <Route path="bovinos" element={<Rebanho />} />
        <Route path="bovinos/pesagens" element={<Pesagens />} />
        <Route path="bovinos/reproducao" element={<Reproducao />} />
        <Route path="bovinos/leite" element={<Leite />} />
        <Route path="bovinos/:id" element={<AnimalDetalhe />} />
        <Route path="aves" element={<LotesAves />} />
        <Route path="aves/producao" element={<ProducaoAves />} />
        <Route path="aves/:id" element={<LoteDetalhe />} />
        <Route path="sanidade" element={<Sanidade />} />
        <Route path="pastagens" element={<Pastagens />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="equipe" element={<Equipe />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Vazio titulo="Página não encontrada" />} />
      </Route>
    </Routes>
  );
}
