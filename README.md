# Gerenciador de Fazenda (Estância)

Aplicação para gestão de uma estância com foco em **gado bovino** e **galinhas**.

- **Front-end:** React + TypeScript + Vite, instalável no celular (PWA) e **funciona sem internet**.
- **Back-end:** Netlify Functions + **Netlify Database** (PostgreSQL), com login e vários usuários.
- **Sincronização:** tudo é gravado primeiro no aparelho; as alterações vão para o banco quando há conexão
  e as dos outros usuários chegam automaticamente.

## Publicar no Netlify

1. No Netlify: **Add new project → Import an existing project → GitHub** e escolha este repositório
   e o branch a publicar. As configurações de build já estão em `netlify.toml`.
2. No primeiro deploy o Netlify cria o banco PostgreSQL (por causa do pacote `@netlify/database`) e aplica
   as migrações de `netlify/database/migrations/` antes de publicar. Não é preciso configurar variáveis.
   > O Netlify Database exige um plano com créditos. Confira os limites do seu plano em
   > *Billing and usage* na documentação do Netlify antes de usar com dados reais.
3. **Logo após o primeiro deploy, abra o site e crie a estância.** A primeira pessoa a acessar vira
   administradora; depois disso o cadastro público é bloqueado e novos acessos são criados em
   **Configurações › Usuários**.
4. No iPhone: abra o site no **Safari → Compartilhar → Adicionar à Tela de Início**. O app abre em tela
   cheia e funciona sem sinal no campo.

Observação: cada *deploy preview* do Netlify usa uma cópia do banco de produção e o link é público.

## Rodar no computador

```bash
npm install
```

```bash
npm run dev
```

O `npm run dev` sobe o app **e a API com um PostgreSQL embutido** (PGlite, dados em `.dados-locais/`),
sem precisar de conta no Netlify. Para testar no celular na mesma rede Wi-Fi, abra o endereço "Network"
que aparece no terminal. Para usar o ambiente do Netlify (`netlify dev`), use `npm run dev:netlify`.

Outros scripts: `npm run build`, `npm run preview` (versão de produção com API local) e `npm test`.

## Como funciona o modo sem internet

- O app inteiro fica guardado no aparelho (service worker) e abre mesmo sem conexão.
- Os dados ficam no armazenamento do aparelho. Cada alteração entra numa fila de envio.
- O indicador no menu (ou no topo, no celular) mostra **Sincronizado**, **N a enviar** ou **Sem internet**;
  toque nele para sincronizar na hora. A sincronização também roda ao abrir o app, ao voltar a conexão e a cada 30 s.
- Se duas pessoas alterarem o **mesmo registro**, vale a alteração mais recente. Registros diferentes nunca se perdem.
- Sair da conta remove os dados do aparelho (eles continuam no servidor). Se houver alterações não enviadas, o app avisa.

## Banco de dados

| Tabela | Conteúdo |
|---|---|
| `fazendas` | A estância |
| `usuarios` | Usuários, papel (administrador/membro), senha com hash scrypt |
| `sessoes` | Sessões de login (só o hash do token é guardado) |
| `registros` | Todos os dados da estância (animais, pesagens, lotes, financeiro…), um por linha, em JSON |

Para relatórios direto no banco há visões prontas: `v_bovinos`, `v_pesagens`, `v_lotes_aves`,
`v_registros_aves` e `v_lancamentos`. Para mudar o esquema, crie uma **nova** migração
(`netlify database migrations new -d "descrição"`); nunca edite uma migração já aplicada.

### API (`/api/*`)

`GET /estado` · `POST /cadastro` · `POST /login` · `POST /logout` · `GET /eu` · `POST /eu/senha` ·
`POST /sync` · `GET|POST /usuarios` · `PATCH /usuarios/:id`

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
shared/colecoes.ts      Tipos do protocolo de sincronização (usados pelo app e pelo servidor)
server/rotas.ts         API: cadastro, login, sessões, usuários e sincronização
server/banco*.ts        Conexão com o Netlify Database e banco embutido para dev/testes
server/vite-api-local.ts  API local no `npm run dev`
netlify/functions/api.ts  Netlify Function que atende /api/*
netlify/database/migrations/  Esquema do PostgreSQL
src/sync/               Motor de sincronização offline, cliente da API
src/types/index.ts      Modelo de dados (todas as entidades)
src/store/useFazenda.ts Estado local (Zustand + armazenamento no aparelho)
src/lib/                Regras zootécnicas, alertas, datas e formatação
src/components/, src/pages/  Interface
```

## Próximos passos sugeridos

- Limite de tentativas de login (proteção contra força bruta).
- Fotos dos animais (Netlify Blobs).
- Relatórios em PDF (GTA, inventário de rebanho, fechamento mensal).
- Migrar o armazenamento local para IndexedDB se o volume de dados crescer muito.
