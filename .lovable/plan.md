# Corrigir leitura de Pix e boleto

## Objetivo
- Ler corretamente o valor disponível no QR Code Pix.
- Obter valor e vencimento de QR Pix dinâmico quando essas informações estiverem no endereço de cobrança.
- Melhorar a captura de códigos de barras bancários e de arrecadação.
- Exibir uma faixa horizontal para alinhar o código e aceitar linhas digitáveis de 44, 47 ou 48 números.

## Implementação
- Validar e interpretar os campos do padrão Pix, incluindo cobranças dinâmicas.
- Consultar com segurança os dados públicos da cobrança Pix dinâmica para preencher valor e vencimento.
- Configurar o leitor para QR Code, ITF, Code 128 e Codabar, com câmera traseira em melhor resolução.
- Adicionar guia visual de captura horizontal e instrução específica para códigos de 48 números.
- Normalizar a linha digitável colada ou capturada antes de calcular o valor e o vencimento.

## Validação
- Testar Pix estático com valor, Pix dinâmico com cobrança, boleto bancário de 44/47 números e arrecadação de 48 números.
- Confirmar que códigos sem vencimento no próprio Pix não substituem a data já preenchida.
