-- Segurança: limite de tentativas de acesso e histórico de versões dos registros.

-- Tentativas que falharam (login, cadastro, troca de senha), para bloquear ataques de força bruta.
CREATE TABLE tentativas_acesso (
  chave text NOT NULL,
  momento timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tentativas_acesso_chave_idx ON tentativas_acesso (chave, momento);
CREATE INDEX tentativas_acesso_momento_idx ON tentativas_acesso (momento);

-- Toda versão substituída de um registro (alteração ou exclusão) é guardada aqui.
-- Permite recuperar dados apagados por engano ou de má-fé (Configurações › Lixeira).
CREATE TABLE registros_historico (
  id bigserial PRIMARY KEY,
  fazenda_id uuid NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  colecao text NOT NULL,
  registro_id text NOT NULL,
  dados jsonb,
  excluido boolean NOT NULL,
  modificado_em bigint NOT NULL,
  atualizado_por uuid,
  substituido_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX registros_historico_registro_idx ON registros_historico (fazenda_id, colecao, registro_id, id);

CREATE FUNCTION guardar_versao_anterior() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO registros_historico (fazenda_id, colecao, registro_id, dados, excluido, modificado_em, atualizado_por)
  VALUES (OLD.fazenda_id, OLD.colecao, OLD.id, OLD.dados, OLD.excluido, OLD.modificado_em, OLD.atualizado_por);
  RETURN NEW;
END;
$$;

CREATE TRIGGER registros_guardar_historico
BEFORE UPDATE ON registros
FOR EACH ROW EXECUTE FUNCTION guardar_versao_anterior();
