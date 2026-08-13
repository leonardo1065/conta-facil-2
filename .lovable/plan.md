# Plan: Implementação de Envio de E-mail via Integração Nativa (Base44/Lovable Core)

O usuário deseja que o sistema envie e-mails utilizando a infraestrutura nativa da plataforma (como em outros projetos do Lovable), onde o remetente é gerenciado e o e-mail de destino deve ser o mesmo do cadastro do usuário.

## Alterações Propostas

### Backend (`src/lib/avisos.server.ts`)
- Ajustar a função `enviarResumo` para priorizar o envio via Lovable quando o e-mail de destino coincidir com o e-mail da conta (identificado no `AvisoPerfil`).
- Garantir que o `remetente()` retorne o fallback correto para a API nativa.
- Melhorar os logs para facilitar o diagnóstico de rejeições pela API.

### Interface (`src/components/SettingsDialog.tsx`)
- Adicionar uma explicação visual informando que o e-mail de avisos deve ser o mesmo do cadastro para usar o envio gratuito nativo.
- Manter a opção de Gmail/SMTP como alternativa para quem deseja usar um e-mail de destino diferente ou remetente próprio.

### Página Inicial (`src/routes/index.tsx`)
- Limpar o texto de depuração no hero/recursos e restaurar uma mensagem profissional sobre o suporte a e-mail e WhatsApp.

## Detalhes Técnicos
- O TanStack Start usará o `sendLovableEmail` do pacote `@lovable.dev/email-js`.
- Verificaremos `perfil.notify_email === user.email` (obtido do `auth.users` via `supabaseAdmin` se necessário, ou assumindo que o perfil reflete isso).
- A lógica de `idempotency_key` será mantida para evitar duplicidade.
