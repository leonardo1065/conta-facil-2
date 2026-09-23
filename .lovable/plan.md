# Excluir cadastro de diária sem apagar histórico

## Alterações
- Adicionar um botão de lixeira em cada diária da lista.
- Pedir confirmação antes de excluir, indicando claramente que o histórico será mantido.
- Marcar a diária selecionada como inativa em todos os meses da mesma série, em vez de apagar seus lançamentos.
- Ocultar diárias inativas da lista principal e manter seus valores no histórico mensal.
- Atualizar imediatamente a lista e o total após a confirmação.

## Detalhes técnicos
- Adicionar um indicador de diária arquivada aos lançamentos, preservando todos os registros existentes.
- Criar uma ação específica para arquivar a série da diária selecionada.
- Validar o fluxo de exclusão e a permanência do histórico.
