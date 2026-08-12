# Plano de Correção: Envio de Avisos por E-mail

O projeto "App Foco Pago" (Agenda Fácil) utiliza o serviço `@lovable.dev/email-js` para o envio automático de avisos. O problema relatado de não envio geralmente decorre de falhas de autenticação (`LOVABLE_API_KEY`), configurações de domínio pendentes ou filtros de segurança no hook público.

## Alterações Propostas

### 1. Diagnóstico e Segurança no Hook
- Adicionar logs detalhados no hook `/api/public/hooks/avisos` para identificar onde o processo interrompe.
- Garantir que a `apikey` enviada pelo cron do banco de dados seja validada corretamente.

### 2. Tratamento de Erros no Envio
- Refinar a função `enviarResumo` em `src/lib/avisos.server.ts` para capturar e registrar erros específicos da API de e-mail do Lovable.
- Verificar se a `LOVABLE_API_KEY` está sendo lida corretamente do ambiente no momento do envio.

### 3. Melhoria na Experiência de Configuração
- Adicionar um botão de "Teste de Envio de E-mail" na tela de configurações (`SettingsDialog.tsx`) para permitir que o usuário verifique a integração imediatamente, sem depender do cron.

## Detalhes Técnicos

- **Hook Público**: O arquivo `src/routes/api/public/hooks/avisos.ts` exige a `apikey` no header. Se o cron não estiver enviando ou a chave estiver incorreta, o envio falha silenciosamente para o usuário final.
- **Log de Notificações**: A tabela `notification_log` será o ponto central para debugar. Vou garantir que falhas críticas de autenticação sejam salvas com mensagens claras.
- **Variáveis de Ambiente**: O envio depende de `LOVABLE_API_KEY`. Se o usuário estiver usando um domínio próprio, `AVISOS_FROM_EMAIL` ou `AVISOS_SENDER_DOMAIN` também precisam estar corretos.

## Passos de Verificação
1. Simular uma chamada ao hook via console para verificar a resposta da API.
2. Conferir os logs no banco de dados após a tentativa de envio.
3. Testar o fluxo de "Prévia com meus dados" para garantir que a montagem do e-mail (HTML/Texto) está íntegra.
