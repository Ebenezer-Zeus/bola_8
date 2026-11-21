// Guarda o token usado para proteger as solicitações contra falsificação.
let csrfToken = '';
// Reaproveita a consulta de sessão se mais de uma ação pedir o token ao mesmo tempo.
let sessionRequest = null;

// Prepara e envia uma ação da conta para o servidor.
async function accountApi(action, data = null) {
    // Consulta a sessão quando esta chamada precisar iniciar ou atualizar o token.
    if (action === 'session') {
        // Evita fazer várias consultas de sessão simultâneas.
        if (!sessionRequest) {
            // Guarda a consulta e limpa a referência quando ela terminar.
            sessionRequest = requestAccountApi(action, data).finally(() => {
                // Permite que uma consulta futura seja realizada novamente.
                sessionRequest = null;
            });
        }
        // Entrega a consulta existente ou recém-iniciada.
        return sessionRequest;
    }

    // Obtém primeiro o token necessário para enviar ações que alteram dados.
    if (data !== null && !csrfToken) {
        // Busca as informações da sessão antes de enviar a ação.
        await accountApi('session');
    }

    // Envia a ação solicitada para a API.
    return requestAccountApi(action, data);
}

// Faz a solicitação HTTP e interpreta a resposta JSON da API.
async function requestAccountApi(action, data) {
    // Define o método HTTP e as opções iniciais da solicitação.
    const options = {
        // Usa GET para consultar e POST para enviar dados.
        method: data === null ? 'GET' : 'POST',
        // Envia e recebe os cookies de sessão deste mesmo site.
        credentials: 'same-origin',
        // Cria o espaço para os cabeçalhos da solicitação.
        headers: {}
    };

    // Acrescenta os dados e o token de proteção às solicitações POST.
    if (data !== null) {
        // Informa ao servidor que o corpo contém JSON.
        options.headers['Content-Type'] = 'application/json';
        // Envia o token de proteção que veio da sessão.
        options.headers['X-CSRF-Token'] = csrfToken;
        // Converte os dados da ação para o formato JSON.
        options.body = JSON.stringify(data);
    }

    // Envia a solicitação para a ação indicada na API PHP.
    const response = await fetch(`account_api.php?action=${encodeURIComponent(action)}`, options);
    // Converte a resposta do servidor de JSON para um objeto JavaScript.
    const result = await response.json();
    // Atualiza o token local caso a resposta forneça um token novo.
    if (result.csrf) csrfToken = result.csrf;
    // Trata respostas HTTP que indicam falha.
    if (!response.ok) {
        // Cria um erro com a mensagem informada pelo servidor.
        const error = new Error(result.error || 'Não foi possível concluir a operação.');
        // Guarda o código HTTP para permitir tratamentos específicos.
        error.status = response.status;
        // Interrompe a ação e entrega o erro a quem chamou esta função.
        throw error;
    }
    // Entrega os dados recebidos quando a solicitação termina com sucesso.
    return result;
}

// Mostra uma mensagem de estado em um elemento da página.
function setAccountMessage(element, message, isError = false) {
    // Encerra sem alterar nada se a página não tiver o elemento indicado.
    if (!element) return;
    // Coloca a mensagem como texto visível.
    element.textContent = message;
    // Marca a mensagem como erro quando necessário.
    element.classList.toggle('is-error', isError);
}

// Atualiza os links e a saudação conforme a sessão atual.
async function renderUserArea() {
    // Procura a área de links da conta na página atual.
    const userArea = document.getElementById('userArea');
    // Não faz nada nas páginas que não têm essa área.
    if (!userArea) return;

    try {
        // Consulta ao servidor qual conta está conectada.
        const { user } = await accountApi('session');
        // Remove os links iniciais antes de montar os links atuais.
        userArea.replaceChildren();

        // Mostra o link de entrada quando ninguém está conectado.
        if (!user) {
            // Cria o link para a tela de login e cadastro.
            const loginLink = document.createElement('a');
            // Define a página aberta ao clicar no link.
            loginLink.href = 'login.html';
            // Define o texto mostrado no link.
            loginLink.textContent = 'Entrar / criar conta';
            // Insere o link na área do usuário.
            userArea.appendChild(loginLink);
            // Acrescenta um separador antes do link do carrinho.
            userArea.append(' | ');
        } else {
            // Cria um elemento para cumprimentar a pessoa conectada.
            const greeting = document.createElement('span');
            // Mostra o nome da conta na saudação.
            greeting.textContent = `Olá, ${user.username}`;
            // Insere a saudação na área do usuário.
            userArea.appendChild(greeting);
            // Acrescenta um separador antes do link do carrinho.
            userArea.append(' | ');
        }

        // Cria o link para consultar o carrinho.
        const cartLink = document.createElement('a');
        // Define a página do carrinho como destino.
        cartLink.href = 'cart.html';
        // Define o texto visível do link do carrinho.
        cartLink.textContent = 'Carrinho';
        // Insere o link do carrinho na área do usuário.
        userArea.appendChild(cartLink);

        // Mostra a opção de sair apenas quando existe uma conta conectada.
        if (user) {
            // Acrescenta um separador antes da opção de sair.
            userArea.append(' | ');
            // Cria o link para encerrar a sessão.
            const logoutLink = document.createElement('a');
            // Impede que o link navegue para outra página.
            logoutLink.href = '#';
            // Define o texto visível da opção.
            logoutLink.textContent = 'Sair';
            // Executa o encerramento quando a opção é clicada.
            logoutLink.addEventListener('click', async event => {
                // Evita a navegação padrão do link.
                event.preventDefault();
                try {
                    // Solicita ao servidor o encerramento da sessão.
                    await accountApi('logout', {});
                    // Volta à página inicial depois de sair.
                    window.location.href = 'index.html';
                } catch (error) {
                    // Mostra uma falha se o servidor não conseguir encerrar a sessão.
                    alert(error.message);
                }
            });
            // Insere a opção de sair na área do usuário.
            userArea.appendChild(logoutLink);
        }
    } catch (error) {
        // Registra no console uma falha ao consultar a sessão.
        console.error('Não foi possível carregar a sessão:', error);
    }
}

// Liga os formulários de entrada e cadastro às ações da API.
function initializeAccountForms() {
    // Encontra o formulário de entrada.
    const loginForm = document.getElementById('loginForm');
    // Encontra o formulário de criação de conta.
    const registerForm = document.getElementById('registerForm');
    // Encontra o espaço onde mensagens de entrada serão exibidas.
    const loginMessage = document.getElementById('loginMessage');
    // Encontra o espaço onde mensagens de cadastro serão exibidas.
    const registerMessage = document.getElementById('registerMessage');

    // Retorna para a página solicitada ou para a página inicial após autenticar.
    const redirectAfterLogin = () => {
        // Lê da URL a página para a qual a pessoa deseja voltar.
        const requestedPage = new URLSearchParams(window.location.search).get('redirect');
        // Aceita somente o carrinho como destino alternativo.
        window.location.href = requestedPage === 'cart.html' ? 'cart.html' : 'index.html';
    };

    // Configura o envio do formulário de entrada quando ele existe na página.
    if (loginForm) {
        // Executa este código quando o formulário for enviado.
        loginForm.addEventListener('submit', async event => {
            // Impede o navegador de enviar e recarregar o formulário.
            event.preventDefault();
            // Lê os campos preenchidos no formulário.
            const formData = new FormData(loginForm);
            try {
                // Obtém um token válido antes de fazer o login.
                await accountApi('session');
                // Envia o nome de usuário e a senha à API.
                await accountApi('login', {
                    // Lê o nome de usuário digitado.
                    username: formData.get('username'),
                    // Lê a senha digitada.
                    password: formData.get('password')
                });
                // Abre a página apropriada após o login.
                redirectAfterLogin();
            } catch (error) {
                // Apresenta no formulário a mensagem de erro do servidor.
                setAccountMessage(loginMessage, error.message, true);
            }
        });
    }

    // Configura o envio do formulário de cadastro quando ele existe na página.
    if (registerForm) {
        // Executa este código quando o formulário for enviado.
        registerForm.addEventListener('submit', async event => {
            // Impede o navegador de enviar e recarregar o formulário.
            event.preventDefault();
            // Lê os campos preenchidos no formulário.
            const formData = new FormData(registerForm);
            try {
                // Obtém um token válido antes de criar a conta.
                await accountApi('session');
                // Envia o novo nome de usuário e a senha à API.
                await accountApi('register', {
                    // Lê o nome de usuário escolhido.
                    username: formData.get('username'),
                    // Lê a senha escolhida.
                    password: formData.get('password')
                });
                // Abre a página apropriada após criar a conta.
                redirectAfterLogin();
            } catch (error) {
                // Apresenta no formulário a mensagem de erro do servidor.
                setAccountMessage(registerMessage, error.message, true);
            }
        });
    }
}

// Disponibiliza a função de comunicação com a API para outros scripts.
window.accountApi = accountApi;
// Aguarda a página carregar antes de atualizar os links e os formulários.
window.addEventListener('DOMContentLoaded', () => {
    // Atualiza os links da conta conforme a sessão.
    renderUserArea();
    // Ativa os formulários disponíveis na página.
    initializeAccountForms();
});
