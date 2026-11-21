<?php
// Exige tipos estritos para reduzir conversões inesperadas de dados.
declare(strict_types=1);

// Informa que todas as respostas deste arquivo serão JSON em UTF-8.
header('Content-Type: application/json; charset=utf-8');
// Impede que respostas da conta sejam guardadas em cache pelo navegador.
header('Cache-Control: no-store');

// Detecta se a conexão atual usa HTTPS.
$isHttps = !empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off';
// Configura o cookie da sessão para limitar sua exposição.
session_set_cookie_params([
    // Mantém a sessão até o navegador ser fechado.
    'lifetime' => 0,
    // Envia o cookie para todas as páginas do site.
    'path' => '/',
    // Envia o cookie apenas por HTTPS quando o site já usa HTTPS.
    'secure' => $isHttps,
    // Impede que JavaScript leia o cookie da sessão.
    'httponly' => true,
    // Restringe o envio do cookie em navegação entre sites.
    'samesite' => 'Lax',
]);
// Rejeita identificadores de sessão que não foram criados pelo servidor.
ini_set('session.use_strict_mode', '1');
// Inicia ou recupera a sessão da pessoa que fez a solicitação.
session_start();

// Envia uma resposta JSON com o código HTTP indicado e encerra a execução.
function respond(int $status, array $payload): void
{
    // Define o código de estado HTTP da resposta.
    http_response_code($status);
    // Converte os dados da resposta para JSON mantendo acentos.
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    // Encerra o script para não enviar conteúdo adicional.
    exit;
}

// Escolhe a pasta privada em que os dados das contas serão guardados.
function storageDirectory(): string
{
    // Lê uma pasta personalizada definida na configuração do servidor.
    $configuredDirectory = getenv('BOLA8_DATA_DIR');
    // Usa a pasta personalizada quando ela foi configurada.
    if ($configuredDirectory !== false && $configuredDirectory !== '') {
        // Devolve o caminho informado pelo servidor.
        return $configuredDirectory;
    }

    // Lê a pasta pública configurada no servidor web.
    $documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
    // Escolhe a pasta superior ao site público como local padrão dos dados.
    $baseDirectory = $documentRoot !== '' ? dirname($documentRoot) : dirname(__DIR__);
    // Devolve o caminho completo da pasta privada padrão.
    return $baseDirectory . DIRECTORY_SEPARATOR . 'bola_8_data';
}

// Lê ou atualiza os dados JSON enquanto impede gravações simultâneas conflitantes.
function withStore(callable $operation, bool $write = true)
{
    // Descobre o diretório que deve guardar os dados.
    $directory = storageDirectory();
    // Cria o diretório privado quando ele ainda não existe.
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        // Informa uma falha se não for possível criar o diretório.
        throw new RuntimeException('Não foi possível criar a pasta privada de dados.');
    }

    // Define onde o arquivo JSON das contas ficará armazenado.
    $storePath = $directory . DIRECTORY_SEPARATOR . 'accounts.json';
    // Abre um arquivo separado usado para coordenar acessos concorrentes.
    $lock = fopen($storePath . '.lock', 'c');
    // Interrompe a operação se o arquivo de bloqueio não puder ser aberto.
    if ($lock === false) {
        // Informa a falha ao chamador.
        throw new RuntimeException('Não foi possível abrir o arquivo de bloqueio dos dados.');
    }

    // Obtém um bloqueio exclusivo antes de acessar o arquivo de dados.
    if (!flock($lock, LOCK_EX)) {
        // Fecha o arquivo se não for possível obter o bloqueio.
        fclose($lock);
        // Informa a falha ao chamador.
        throw new RuntimeException('Não foi possível bloquear os dados.');
    }

    // Garante que o bloqueio seja liberado mesmo quando uma operação falhar.
    try {
        // Lê os dados existentes quando o arquivo já foi criado.
        if (is_file($storePath)) {
            // Carrega o conteúdo JSON do arquivo de contas.
            $contents = file_get_contents($storePath);
            // Interrompe a operação se o arquivo não puder ser lido.
            if ($contents === false) {
                // Informa a falha de leitura ao chamador.
                throw new RuntimeException('Não foi possível ler os dados das contas.');
            }
            // Converte o JSON em um array PHP.
            $store = json_decode($contents, true);
            // Rejeita arquivos quebrados ou sem a lista de contas.
            if (!is_array($store) || !isset($store['users']) || !is_array($store['users'])) {
                // Informa que os dados salvos precisam ser corrigidos.
                throw new RuntimeException('O arquivo de dados das contas está inválido.');
            }
        } else {
            // Cria a estrutura inicial quando ainda não há contas salvas.
            $store = ['users' => []];
        }

        // Executa a operação solicitada usando os dados carregados.
        $result = $operation($store);

        // Grava os dados somente quando a operação pediu uma alteração.
        if ($write) {
            // Converte o array atualizado para JSON preservando acentos.
            $contents = json_encode($store, JSON_UNESCAPED_UNICODE);
            // Salva o JSON e verifica se a conversão ou a gravação falhou.
            if ($contents === false || file_put_contents($storePath, $contents, LOCK_EX) === false) {
                // Informa a falha de gravação ao chamador.
                throw new RuntimeException('Não foi possível salvar os dados das contas.');
            }
            // Define permissões restritas em sistemas que suportam essa configuração.
            if (DIRECTORY_SEPARATOR !== '\\') {
                // Limita o acesso ao arquivo e ao bloqueio ao usuário do servidor.
                if (!chmod($storePath, 0600) ||
                    !chmod($storePath . '.lock', 0600) ||
                    !chmod($directory, 0700)) {
                    // Informa que não foi possível proteger os dados no sistema de arquivos.
                    throw new RuntimeException('Não foi possível proteger as permissões dos dados.');
                }
            }
        }

        // Devolve o resultado produzido pela operação executada.
        return $result;
    } finally {
        // Libera o bloqueio exclusivo do arquivo.
        flock($lock, LOCK_UN);
        // Fecha o arquivo de bloqueio.
        fclose($lock);
    }
}

// Confirma que a sessão contém a identificação de uma conta conectada.
function requireAuthenticatedUser(): string
{
    // Rejeita sessões sem uma identificação de usuário válida.
    if (!isset($_SESSION['user_id']) || !is_string($_SESSION['user_id'])) {
        // Responde com código de não autenticado e encerra a solicitação.
        respond(401, ['error' => 'Faça login para acessar esta função.']);
    }
    // Devolve a identificação da conta conectada.
    return $_SESSION['user_id'];
}

// Lê e valida o corpo JSON enviado pelo navegador.
function readRequestBody(): array
{
    // Converte o corpo HTTP recebido em um array PHP.
    $body = json_decode((string) file_get_contents('php://input'), true);
    // Rejeita corpos vazios ou que não contêm um objeto JSON válido.
    if (!is_array($body)) {
        // Responde com erro de solicitação inválida.
        respond(400, ['error' => 'A solicitação enviada é inválida.']);
    }
    // Devolve os dados recebidos depois da validação.
    return $body;
}

// Lê do CSV os nomes válidos de produtos da loja.
function availableProductNames(): array
{
    // Monta o caminho do arquivo CSV do catálogo.
    $csvPath = __DIR__ . DIRECTORY_SEPARATOR . 'Produtos inteligentes.csv';
    // Abre o catálogo para leitura.
    $file = fopen($csvPath, 'r');
    // Informa uma falha caso o arquivo do catálogo não possa ser aberto.
    if ($file === false) {
        // Interrompe a operação com uma mensagem explícita.
        throw new RuntimeException('Não foi possível abrir a lista de produtos.');
    }

    // Prepara a lista que receberá os nomes encontrados.
    $names = [];
    // Descarta a primeira linha, que contém os nomes das colunas.
    fgetcsv($file, 0, ',');
    // Lê cada linha de dados até o fim do arquivo.
    while (($row = fgetcsv($file, 0, ',')) !== false) {
        // Guarda o nome quando a linha contém um valor não vazio.
        if (isset($row[0]) && trim($row[0]) !== '') {
            // Limpa espaços ao redor do nome do produto antes de guardá-lo.
            $names[] = trim($row[0]);
        }
    }
    // Fecha o CSV depois da leitura.
    fclose($file);
    // Devolve os nomes válidos encontrados no catálogo.
    return $names;
}

// Inicia o tratamento da ação solicitada pela página.
try {
    // Lê o nome da ação enviado na URL ou usa vazio quando não foi informado.
    $action = $_GET['action'] ?? '';

    // Trata a consulta de sessão sem exigir uma sessão autenticada.
    if ($action === 'session') {
        // Permite somente solicitações GET para consultar a sessão.
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            // Informa que o método HTTP usado não é aceito.
            respond(405, ['error' => 'Método não permitido.']);
        }
        // Cria um token de proteção quando a sessão ainda não possui um.
        if (!isset($_SESSION['csrf_token'])) {
            // Gera um token aleatório difícil de adivinhar.
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        // Prepara o nome da conta conectada ou null se ninguém entrou.
        $user = isset($_SESSION['username']) ? ['username' => $_SESSION['username']] : null;
        // Devolve os dados da sessão e o token de proteção.
        respond(200, ['user' => $user, 'csrf' => $_SESSION['csrf_token']]);
    }

    // Trata a consulta do carrinho da conta conectada.
    if ($action === 'cart_get') {
        // Permite somente solicitações GET para consultar o carrinho.
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            // Informa que o método HTTP usado não é aceito.
            respond(405, ['error' => 'Método não permitido.']);
        }
        // Exige uma sessão autenticada e obtém a identificação da conta.
        $userId = requireAuthenticatedUser();
        // Busca o carrinho que pertence à conta conectada sem alterar o arquivo.
        $cart = withStore(function (array &$store) use ($userId): array {
            // Percorre as contas salvas à procura da identificação atual.
            foreach ($store['users'] as $user) {
                // Compara a identificação salva com a da sessão.
                if (($user['id'] ?? null) === $userId) {
                    // Devolve o carrinho salvo ou uma lista vazia se ainda não existir.
                    return is_array($user['cart'] ?? null) ? $user['cart'] : [];
                }
            }
            // Rejeita uma sessão cuja conta não existe mais nos dados salvos.
            respond(401, ['error' => 'Sua sessão não corresponde a uma conta válida.']);
        // Indica que esta consulta não deve gravar o arquivo.
        }, false);
        // Devolve o carrinho encontrado à página.
        respond(200, ['cart' => $cart]);
    }

    // Exige POST para todas as ações restantes, que alteram informações.
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        // Informa que o método HTTP usado não é aceito.
        respond(405, ['error' => 'Método não permitido.']);
    }

    // Lê o token de proteção enviado no cabeçalho HTTP.
    $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    // Confere se o token enviado corresponde ao token da sessão.
    if (!isset($_SESSION['csrf_token']) || !is_string($csrfToken) ||
        !hash_equals($_SESSION['csrf_token'], $csrfToken)) {
        // Rejeita a ação quando o token está ausente ou não confere.
        respond(403, ['error' => 'Sessão expirada. Atualize a página e tente novamente.']);
    }

    // Lê os dados JSON enviados com a ação.
    $body = readRequestBody();

    // Trata o cadastro de conta ou a entrada em uma conta existente.
    if ($action === 'register' || $action === 'login') {
        // Verifica se os campos de usuário e senha são textos enviados.
        if (!isset($body['username'], $body['password']) ||
            !is_string($body['username']) || !is_string($body['password'])) {
            // Rejeita os dados quando usuário ou senha não foram enviados corretamente.
            respond(400, ['error' => 'Informe um usuário e uma senha válidos.']);
        }
        // Remove espaços excedentes antes e depois do nome informado.
        $username = trim($body['username']);
        // Guarda a senha recebida para validar ou criar a conta.
        $password = $body['password'];
        // Usa uma versão minúscula como chave para evitar nomes repetidos por caixa.
        $usernameKey = strtolower($username);

        // Executa as validações específicas do cadastro.
        if ($action === 'register') {
            // Aceita somente nomes de 3 a 32 caracteres com os símbolos permitidos.
            if (!preg_match('/^[A-Za-z0-9._-]{3,32}$/D', $username)) {
                // Explica o formato necessário para o nome da conta.
                respond(400, ['error' => 'O usuário deve ter de 3 a 32 caracteres: letras, números, ponto, hífen ou sublinhado.']);
            }
            // Exige senha com tamanho compatível e suficiente.
            if (strlen($password) < 8 || strlen($password) > 72) {
                // Informa o limite aceito para a senha.
                respond(400, ['error' => 'A senha deve ter entre 8 e 72 bytes.']);
            }

            // Cria a conta dentro de uma operação protegida por bloqueio do arquivo.
            $user = withStore(function (array &$store) use ($usernameKey, $username, $password): array {
                // Evita cadastrar novamente um nome já utilizado.
                if (isset($store['users'][$usernameKey])) {
                    // Informa que o nome de usuário já existe.
                    respond(409, ['error' => 'Esse nome de usuário já está cadastrado.']);
                }
                // Monta os dados iniciais da nova conta.
                $user = [
                    // Gera uma identificação aleatória para a conta.
                    'id' => bin2hex(random_bytes(16)),
                    // Guarda a forma original do nome para exibir na página.
                    'username' => $username,
                    // Salva somente o hash da senha, nunca a senha original.
                    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                    // Começa com um carrinho vazio exclusivo para esta conta.
                    'cart' => [],
                ];
                // Guarda a conta pela chave normalizada do nome.
                $store['users'][$usernameKey] = $user;
                // Devolve os dados da conta criada.
                return $user;
            });
        } else {
            // Procura a conta e confere a senha sem modificar os dados salvos.
            $user = withStore(function (array &$store) use ($usernameKey, $password): ?array {
                // Busca a conta pela chave normalizada do nome.
                $user = $store['users'][$usernameKey] ?? null;
                // Rejeita conta inexistente ou senha que não corresponda ao hash.
                if (!is_array($user) || !isset($user['password_hash']) ||
                    !is_string($user['password_hash']) ||
                    !password_verify($password, $user['password_hash'])) {
                    // Indica que a autenticação não encontrou credenciais válidas.
                    return null;
                }
                // Devolve os dados da conta autenticada.
                return $user;
            // Indica que a conferência de senha não altera o arquivo.
            }, false);

            // Responde com erro quando o nome ou a senha não forem válidos.
            if ($user === null) {
                // Mantém uma mensagem genérica para não revelar qual campo falhou.
                respond(401, ['error' => 'Usuário ou senha incorretos.']);
            }
        }

        // Troca o identificador da sessão após autenticar para evitar reutilização.
        session_regenerate_id(true);
        // Registra na sessão a identificação da conta conectada.
        $_SESSION['user_id'] = $user['id'];
        // Registra na sessão o nome que será exibido na página.
        $_SESSION['username'] = $user['username'];
        // Gera um novo token para proteger as próximas ações.
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        // Confirma a autenticação e devolve o token atualizado.
        respond(200, [
            // Devolve apenas o nome público da conta.
            'user' => ['username' => $user['username']],
            // Devolve o token que deve acompanhar as próximas alterações.
            'csrf' => $_SESSION['csrf_token'],
        ]);
    }

    // Encerra a sessão quando a ação solicitada é sair.
    if ($action === 'logout') {
        // Apaga todos os dados associados à sessão atual.
        $_SESSION = [];
        // Remove o cookie da sessão quando ele está habilitado.
        if (ini_get('session.use_cookies')) {
            // Lê as configurações atuais do cookie para removê-lo corretamente.
            $cookie = session_get_cookie_params();
            // Expira o cookie da sessão no navegador.
            setcookie(session_name(), '', [
                // Define uma data passada para apagar o cookie.
                'expires' => time() - 42000,
                // Mantém o caminho configurado para o cookie original.
                'path' => $cookie['path'],
                // Mantém o domínio configurado para o cookie original.
                'domain' => $cookie['domain'],
                // Mantém a configuração HTTPS do cookie original.
                'secure' => $cookie['secure'],
                // Mantém a proteção contra acesso por JavaScript.
                'httponly' => $cookie['httponly'],
                // Mantém a restrição de envio entre sites.
                'samesite' => 'Lax',
            ]);
        }
        // Destrói os dados da sessão no servidor.
        session_destroy();
        // Confirma que a conta saiu.
        respond(200, ['message' => 'Você saiu da sua conta.']);
    }

    // Exige uma conta autenticada para alterar o carrinho.
    $userId = requireAuthenticatedUser();

    // Trata as ações de adicionar produto ou removê-lo do carrinho.
    if ($action === 'cart_add' || $action === 'cart_remove') {
        // Confirma que o nome do produto foi enviado como texto.
        if (!isset($body['name']) || !is_string($body['name'])) {
            // Rejeita dados de produto malformados.
            respond(400, ['error' => 'Informe um produto válido.']);
        }
        // Limpa espaços ao redor do nome do produto.
        $name = trim((string) ($body['name'] ?? ''));
        // Confere que o produto realmente aparece no catálogo da loja.
        if (!in_array($name, availableProductNames(), true)) {
            // Rejeita produtos que não estão no catálogo.
            respond(400, ['error' => 'O produto informado não está disponível.']);
        }

        // Atualiza somente o carrinho da conta identificada pela sessão.
        $cart = withStore(function (array &$store) use ($userId, $action, $name): array {
            // Percorre as contas salvas e mantém referência para editar a conta encontrada.
            foreach ($store['users'] as &$user) {
                // Ignora as contas que não pertencem à sessão atual.
                if (($user['id'] ?? null) !== $userId) {
                    // Continua procurando a conta correta.
                    continue;
                }
                // Corrige o carrinho se os dados anteriores estiverem ausentes ou inválidos.
                if (!isset($user['cart']) || !is_array($user['cart'])) {
                    // Inicializa um carrinho vazio para esta conta.
                    $user['cart'] = [];
                }
                // Aumenta a quantidade quando a ação é adicionar ao carrinho.
                if ($action === 'cart_add') {
                    // Lê quantas unidades deste produto já estão no carrinho.
                    $quantity = (int) ($user['cart'][$name] ?? 0);
                    // Impede que a quantidade ultrapasse 99 unidades.
                    if ($quantity >= 99) {
                        // Informa ao navegador que o limite foi atingido.
                        respond(400, ['error' => 'O limite deste produto no carrinho é 99 unidades.']);
                    }
                    // Guarda a quantidade aumentada em uma unidade.
                    $user['cart'][$name] = $quantity + 1;
                } else {
                    // Remove todas as unidades deste produto do carrinho.
                    unset($user['cart'][$name]);
                }
                // Guarda o carrinho atualizado para enviá-lo na resposta.
                $cart = $user['cart'];
                // Libera a referência usada durante a iteração.
                unset($user);
                // Devolve o carrinho atualizado.
                return $cart;
            }
            // Libera a referência mesmo quando nenhuma conta foi encontrada.
            unset($user);
            // Rejeita uma sessão cuja conta não existe mais nos dados salvos.
            respond(401, ['error' => 'Sua sessão não corresponde a uma conta válida.']);
        });
        // Confirma a atualização e devolve o carrinho atualizado.
        respond(200, ['cart' => $cart]);
    }

    // Informa quando a ação solicitada não existe.
    respond(404, ['error' => 'Ação não encontrada.']);
// Captura falhas inesperadas e registra detalhes somente no log do servidor.
} catch (Throwable $error) {
    // Guarda detalhes técnicos para diagnóstico sem expô-los na página.
    error_log('Erro no account_api.php: ' . $error->getMessage());
    // Devolve uma mensagem segura e genérica ao navegador.
    respond(500, ['error' => 'Não foi possível concluir a operação. Verifique a configuração do servidor.']);
}
