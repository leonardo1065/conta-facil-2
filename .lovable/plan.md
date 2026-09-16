# Plano — leitura e interpretação de QR Code

## O que será feito
- Melhorar a câmera para priorizar QR Code Pix e códigos de barras de boletos.
- Interpretar o conteúdo lido e identificar se é Pix, boleto ou código inválido.
- Preencher automaticamente o valor e vencimento quando essas informações estiverem presentes.
- Manter a opção de colar o código e mostrar uma mensagem clara sobre o resultado.

## Detalhes técnicos
- Ajustar o leitor em `ScannerDialog` para processar apenas uma leitura válida por abertura e permitir tentar novamente quando o código não for reconhecido.
- Fortalecer o interpretador Pix/EMV e a conversão de linha digitável de boletos em `boleto.ts`.
- Ajustar `EntryDialog` para informar o tipo interpretado e preservar os dados digitados quando o QR não trouxer valor ou data.

## Verificação
- Testar interpretação de payload Pix com valor.
- Testar boleto por linha digitável e código de barras.
- Confirmar que código desconhecido não fecha a câmera nem altera o lançamento.
