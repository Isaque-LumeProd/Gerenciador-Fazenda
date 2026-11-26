-- Esquema inicial do Gerenciador da Estância.
-- Aplicado automaticamente pelo Netlify a cada deploy (e localmente pelo servidor de desenvolvimento).

CREATE TABLE fazendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  papel text NOT NULL CHECK (papel IN ('admin', 'membro')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessoes (
  token_hash text PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em timestamptz NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessoes_usuario_idx ON sessoes (usuario_id);

-- Todos os registros da estância (animais, pesagens, lotes, financeiro...), um por linha.
-- `seq` cresce a cada gravação e permite que cada aparelho busque só o que mudou.
CREATE SEQUENCE registros_seq;

CREATE TABLE registros (
  fazenda_id uuid NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  colecao text NOT NULL,
  id text NOT NULL,
  dados jsonb,
  excluido boolean NOT NULL DEFAULT false,
  modificado_em bigint NOT NULL,
  seq bigint NOT NULL DEFAULT nextval('registros_seq'),
  atualizado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fazenda_id, colecao, id)
);
CREATE INDEX registros_sync_idx ON registros (fazenda_id, seq);

-- Visões para consultas e relatórios direto no banco (ex.: em uma ferramenta de BI).
CREATE VIEW v_bovinos AS
SELECT fazenda_id, id,
  dados->>'brinco' AS brinco, dados->>'nome' AS nome, dados->>'raca' AS raca, dados->>'sexo' AS sexo,
  (dados->>'dataNascimento')::date AS data_nascimento, dados->>'finalidade' AS finalidade,
  dados->>'status' AS status, dados->>'pastoId' AS pasto_id, dados->>'maeId' AS mae_id
FROM registros WHERE colecao = 'bovinos' AND NOT excluido;

CREATE VIEW v_pesagens AS
SELECT fazenda_id, id, dados->>'bovinoId' AS bovino_id, (dados->>'data')::date AS data,
  (dados->>'pesoKg')::numeric AS peso_kg
FROM registros WHERE colecao = 'pesagens' AND NOT excluido;

CREATE VIEW v_lotes_aves AS
SELECT fazenda_id, id, dados->>'codigo' AS codigo, dados->>'finalidade' AS finalidade,
  dados->>'raca' AS raca, dados->>'galpao' AS galpao, (dados->>'dataAlojamento')::date AS data_alojamento,
  (dados->>'quantidadeInicial')::int AS quantidade_inicial, dados->>'status' AS status
FROM registros WHERE colecao = 'lotesAves' AND NOT excluido;

CREATE VIEW v_registros_aves AS
SELECT fazenda_id, id, dados->>'loteId' AS lote_id, (dados->>'data')::date AS data,
  (dados->>'ovos')::int AS ovos, (dados->>'ovosDescarte')::int AS ovos_descarte,
  (dados->>'mortes')::int AS mortes, (dados->>'racaoKg')::numeric AS racao_kg
FROM registros WHERE colecao = 'registrosAves' AND NOT excluido;

CREATE VIEW v_lancamentos AS
SELECT fazenda_id, id, dados->>'tipo' AS tipo, dados->>'categoria' AS categoria,
  dados->>'atividade' AS atividade, dados->>'descricao' AS descricao,
  (dados->>'valor')::numeric AS valor, (dados->>'data')::date AS data, (dados->>'pago')::boolean AS pago
FROM registros WHERE colecao = 'lancamentos' AND NOT excluido;
