<?php
// Recebe o valor do campo 'usuario' enviado via POST
$usuario = $_POST['usuario'];
// Recebe o valor do campo 'senha' enviado via POST
$senha = $_POST['senha'];

// Validação simples de credenciais (EXEMPLO): compara com valores fixos
// Observação: este método NÃO é seguro para produção — apenas demonstração
if ($usuario == 'admin' && $senha == '1234') {
    // Se usuário e senha conferirem, imprime mensagem de sucesso
    echo "Login bem-sucedido!";
} else {
    // Caso contrário, informa que as credenciais são inválidas
    echo "Usuário ou senha incorretos.";
}
?>
