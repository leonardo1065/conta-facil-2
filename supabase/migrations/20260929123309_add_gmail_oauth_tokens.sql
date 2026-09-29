-- Adiciona colunas OAuth2 para Gmail na tabela profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS oauth_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS oauth_token_expiry   BIGINT; -- unix timestamp
