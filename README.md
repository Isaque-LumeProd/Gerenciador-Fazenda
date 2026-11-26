# Gerenciador de Fazenda (Estância)

Aplicação web para gestão de uma estância com foco em **gado bovino** e **galinhas**.
Feita em **React + TypeScript + Vite**, com dados salvos no navegador (localStorage) e
backup/importação em JSON. Na primeira execução é carregada uma estância de demonstração.

## Como rodar

```bash
npm install
```

```bash
npm run dev
```

Outros scripts: `npm run build` (build de produção em `dist/`), `npm test` (testes de regras de negócio).

## Módulos

| Área | O que faz |
|---|---|
| **Painel** | Indicadores (rebanho, UA, lotação, valor estimado em @, aves, ovos/dia, resultado do mês), gráfico de receitas × despesas, produção de ovos, composição do rebanho, alertas e próximas tarefas |
| **Bovinos › Rebanho** | Cadastro por brinco, raça, sexo, nascimento, finalidade, origem, mãe/pai e pasto; categoria automática (bezerro, garrote, novilha, vaca, boi, touro); filtros; exportação CSV; registro de saída (venda gera receita / morte) |
| **Bovinos › Ficha do animal** | Curva de peso, GMD, arrobas e valor, genealogia, crias, sanidade, histórico reprodutivo e carência |
| **Bovinos › Pesagens** | Pesagem individual e **em lote** (por pasto), GMD entre pesagens |
| **Bovinos › Reprodução** | Cobertura, IA, diagnóstico, parto (cadastra o bezerro automaticamente) e aborto; parto previsto (283 dias), taxa de prenhez e intervalo entre partos |
| **Bovinos › Leite** | Ordenha diária, litros/vaca, total do mês |
| **Aves › Lotes** | Lotes de postura, corte e matrizes; aves vivas, idade, mortalidade, taxa de postura, peso médio, conversão alimentar, ração por dúzia |
| **Aves › Produção diária** | Lançamento rápido do dia para todos os lotes (ovos, descarte, mortes, ração) e resumo diário |
| **Sanidade** | Vacinas, vermífugos, medicamentos e exames por animal, lote ou rebanho; agenda de próximas doses com botão "Aplicar"; períodos de carência |
| **Pastagens** | Piquetes com área, forrageira e situação (uso/descanso/reforma); cabeças, UA e lotação por pasto |
| **Estoque** | Insumos com saldo, mínimo e custo; entradas/saídas (entrada pode lançar despesa) |
| **Financeiro** | Receitas e despesas por categoria e atividade (bovinos/aves/geral), fluxo mensal, contas pendentes/vencidas |
| **Agenda** | Tarefas agrupadas por prazo, prioridade, área e responsável |
| **Equipe** | Funcionários e lançamento da folha no financeiro |
| **Configurações** | Dados da estância, preço da arroba e da dúzia, backup/importação, demonstração ou começar do zero |

Alertas automáticos: doses atrasadas ou próximas, partos previstos, estoque abaixo do mínimo,
tarefas atrasadas, mortalidade alta em lotes de aves, lote sem registro recente e contas vencidas.

## Estrutura

```
src/
  types/index.ts        Modelo de dados (todas as entidades)
  store/useFazenda.ts   Estado global (Zustand + persistência), CRUD genérico, exclusão em cascata
  store/seed.ts         Estância de demonstração
  lib/zootecnia.ts      Regras: categoria, GMD, arrobas, UA, lotação, reprodução, índices de aves
  lib/alertas.ts        Geração dos alertas do painel
  lib/datas.ts, formato.ts, hooks.ts
  components/           Layout, UI (cards, modais, campos), gráficos, ícones
  pages/                Painel, bovinos/*, aves/*, Sanidade, Pastagens, Estoque, Financeiro, Agenda, Equipe, Configuracoes
```

## Próximos passos sugeridos

- Backend (ex.: Supabase/PostgreSQL ou API Node) para uso multiusuário e em vários dispositivos —
  a camada `store/useFazenda.ts` concentra o acesso aos dados, facilitando a troca.
- Login e perfis (proprietário, capataz, tratador).
- PWA/offline para lançamentos no campo.
- Relatórios em PDF (GTA, inventário de rebanho, fechamento mensal).
