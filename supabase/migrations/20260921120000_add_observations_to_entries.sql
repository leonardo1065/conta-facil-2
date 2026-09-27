-- Adiciona coluna observations na tabela entries para controlar tipo de lembrete
-- Valor pode conter: 'email', 'whatsapp', 'both' ou estar vazio
ALTER TABLE entries ADD COLUMN IF NOT EXISTS observations TEXT DEFAULT NULL;

COMMENT ON COLUMN entries.observations IS 'Tipo de lembrete: email, whatsapp, both ou null (sem lembrete)';