# Plano de Correção: Configuração Direta de E-mail (Gmail)

O usuário relatou dificuldade em encontrar onde cadastrar a "senha de 16 dígitos" (senha de app do Gmail) e solicitou uma forma de apenas digitar a senha e deixar o sistema resolver o restante. Vou implementar campos de configuração direta na interface de "Configurações" do app, que salvarão esses dados nos metadados do perfil do usuário, e ajustar o servidor para priorizar essas configurações individuais sobre os segredos globais.

## Alterações

### 1. Interface (Frontend)
- Modificar `src/components/SettingsDialog.tsx` para incluir uma nova seção: "Configuração Personalizada de E-mail (Gmail)".
- Adicionar campos para `SMTP_USER` (e-mail) e `SMTP_PASS` (senha de app).
- Manter os valores `smtp.gmail.com` e porta `587` como padrão sugerido/automático para facilitar.

### 2. Backend (Servidor)
- Ajustar `src/lib/avisos.server.ts` na função `enviarEmailSMTP`:
  - Primeiro, tentar ler as credenciais de SMTP do perfil do usuário (`profiles.smtp_config`).
  - Caso não existam, manter o fallback para as variáveis de ambiente globais (`process.env.SMTP_*`).
- Atualizar a função `enviarResumo` para passar essas configurações se disponíveis.

### 3. Banco de Dados
- Adicionar uma coluna `smtp_config` (tipo JSONB) na tabela `public.profiles` para armazenar de forma segura (via RLS) as configurações de e-mail do usuário.

## Detalhes Técnicos
- **Segurança**: As configurações de SMTP serão salvas na tabela `profiles`. Como a tabela tem RLS habilitado, apenas o próprio usuário pode ler ou gravar seus dados.
- **Simplicidade**: O usuário não precisará mais mexer na aba "Secrets" da Lovable Cloud, fazendo tudo por dentro do próprio aplicativo.

## Passos
1. Criar migração para adicionar `smtp_config` na tabela `profiles`.
2. Atualizar `src/integrations/supabase/types.ts` (se necessário) ou lidar com o tipo dinamicamente.
3. Modificar `src/lib/avisos.server.ts` para usar a nova configuração.
4. Atualizar `src/components/SettingsDialog.tsx` com os novos campos e lógica de salvamento.
5. Atualizar a página inicial com a mensagem de confirmação.
