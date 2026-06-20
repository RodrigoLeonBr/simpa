-- ============================================================================
-- SIMPA — Migration 002: Auth & audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id           BIGSERIAL PRIMARY KEY,
    username     VARCHAR(80) UNIQUE NOT NULL,
    senha_hash   VARCHAR(200) NOT NULL,
    nome         VARCHAR(200) NOT NULL,
    perfil       VARCHAR(40) NOT NULL
                 CHECK (perfil IN (
                     'Administrador',
                     'Gestor Secretaria',
                     'Gestor de Unidade',
                     'Planejamento'
                 )),
    ativo        BOOLEAN NOT NULL DEFAULT true,
    criado_em    TIMESTAMP NOT NULL DEFAULT now(),
    ultimo_login TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    acao       VARCHAR(80) NOT NULL,
    recurso    VARCHAR(200),
    detalhes   JSONB,
    ip         VARCHAR(45),
    criado_em  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_usuario
    ON audit_log (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_acao
    ON audit_log (acao, criado_em DESC);

CREATE TABLE IF NOT EXISTS configuracoes (
    chave       VARCHAR(80) PRIMARY KEY,
    valor       TEXT NOT NULL,
    descricao   VARCHAR(300),
    atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE usuarios IS 'Contas de acesso ao SIMPA. Senha bcrypt — seed aplicado na Task 04.';
COMMENT ON TABLE audit_log IS 'Trilha de auditoria: login, exportações, ações administrativas.';
COMMENT ON TABLE configuracoes IS 'Parâmetros do sistema (ex.: competencia_ativa_padrao).';
