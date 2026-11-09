-- Ofertas enviadas pelos alunos. Aplicar com:
--   npx wrangler d1 execute gravitas-hub-ofertas --remote --file schema.sql
CREATE TABLE IF NOT EXISTS ofertas_alunos (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pendente',  -- pendente | aprovada (recusada é apagada)
  dados TEXT NOT NULL,                      -- JSON com os campos da oferta
  link_chave TEXT NOT NULL,                 -- link normalizado, para barrar repetidas
  email TEXT NOT NULL,                      -- quem enviou (só o admin vê, e só enquanto está pendente)
  nome TEXT NOT NULL DEFAULT '',
  data_envio TEXT NOT NULL,                 -- DD/MM/AAAA, horário de Brasília
  criado_em INTEGER NOT NULL,
  aprovado_em INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_link ON ofertas_alunos(link_chave);
CREATE INDEX IF NOT EXISTS idx_ofertas_status ON ofertas_alunos(status, criado_em);
CREATE INDEX IF NOT EXISTS idx_ofertas_email ON ofertas_alunos(email, criado_em);
