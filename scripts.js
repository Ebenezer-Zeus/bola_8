
// Array que armazenará os produtos carregados (inicialmente vazio)
let produtos = [];

// Ao carregar a página, busca os produtos no servidor (importar_csv.php)
window.addEventListener('DOMContentLoaded', () => {
    // Detecta a tela do carrinho pelo elemento que só existe nela.
    if (document.getElementById('cartItems')) {
        // Carrega os itens da conta conectada e não tenta renderizar a vitrine.
        carregarCarrinho();
        // Encerra a inicialização específica desta página.
        return;
    }
    // Ignora páginas sem catálogo de produtos, como a tela de login.
    if (!document.getElementById('productList')) return;

    // Tenta primeiro usar o endpoint PHP que retorna JSON
    fetch('importar_csv.php')
        // Verifica se o servidor respondeu com sucesso.
        .then(res => {
            if (!res.ok) throw new Error('Resposta não OK');
            // Converte a resposta do servidor para JSON.
            return res.json();
        })
        // Usa os dados recebidos para montar a lista de produtos.
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) throw new Error('JSON vazio ou inválido');
            setProdutosFromData(data);
        })
        // Se a busca em PHP falhar, tenta carregar o arquivo CSV diretamente.
        .catch(err => {
            console.warn('Falha ao carregar JSON via PHP, tentando CSV client-side:', err);
            // Fallback: tenta carregar o CSV diretamente (útil se não estiver rodando via servidor PHP)
            fetch('Produtos inteligentes.csv')
                // Verifica se o arquivo CSV foi encontrado.
                .then(r => {
                    if (!r.ok) throw new Error('Não foi possível carregar produtos.csv');
                    // Lê o conteúdo do arquivo como texto.
                    return r.text();
                })
                // Converte o CSV em produtos e exibe a lista.
                .then(text => {
                    const parsed = parseCSV(text);
                    setProdutosFromData(parsed);
                })
                // Registra no console se também não foi possível ler o CSV.
                .catch(err2 => {
                    console.error('Erro ao carregar produtos via CSV:', err2);
                });
        });
});

// Normaliza e seta o array global a partir de dados brutos (JSON ou CSV parsed)
function setProdutosFromData(data) {
    // Padroniza os campos e remove espaços extras de cada produto.
    produtos = data.map(p => ({
        nome: (p.nome || '').toString().trim(),
        descricao: (p.descricao || '').toString().trim(),
        preco: parseFloat((p.preco || 0).toString().replace(/[^0-9,]/g, '').replace(',', '.')) || 0,
        imagem: (p.imagem || '').toString().trim(),
        categoria: (p.categoria || '').toString().trim()
    }));
    // Atualiza as opções de categoria disponíveis no filtro.
    populateCategoryFilter();
    // Exibe todos os produtos recebidos.
    renderProducts(produtos);
}

// Parser simples de CSV que entende aspas ("...") e vírgulas internas
function parseCSV(text) {
    // Remove quebras de linha do Windows, divide o arquivo em linhas e ignora linhas vazias.
    const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
    // Retorna uma lista vazia se o CSV não tiver cabeçalho e dados.
    if (lines.length <= 1) return [];
    // Lê os nomes das colunas na primeira linha.
    const header = parseCSVLine(lines[0]);
    // Converte cada linha restante em uma lista de valores.
    const rows = lines.slice(1).map(l => parseCSVLine(l));
    // Cria a lista onde serão guardados os produtos convertidos.
    const result = [];
    // Percorre as linhas de dados do arquivo.
    rows.forEach(cols => {
        if (cols.length < header.length) return; // pula linhas incompletas
        // Cria um objeto para relacionar nomes de colunas aos seus valores.
        const obj = {};
        // Percorre as colunas da linha atual.
        for (let i = 0; i < header.length; i++) {
            // Padroniza o nome da coluna e associa o valor correspondente.
            const key = header[i].toLowerCase().replace(/[^a-z0-9]+/g, '_');
            obj[key] = cols[i];
        }
        // Normaliza os campos para os nomes usados no app
        result.push({
            nome: obj['nome'] || obj['name'] || '',
            descricao: obj['descrição'] || obj['descricao'] || obj['descri_o'] || obj['description'] || '',
            preco: obj['preco'] || obj['pre_o'] || obj['price'] || 0,
            imagem: obj['imagem'] || obj['image'] || '',
            categoria: obj['categoria'] || obj['category'] || ''
        });
    });
    return result;
}

function parseCSVLine(line) {
    // Guarda os valores encontrados na linha.
    const result = [];
    // Guarda o texto da célula que está sendo lida.
    let cur = '';
    // Indica se a leitura está dentro de um campo entre aspas.
    let inQuotes = false;
    // Analisa cada caractere da linha.
    for (let i = 0; i < line.length; i++) {
        // Lê o caractere atual.
        const ch = line[i];
        // Trata aspas que iniciam ou terminam um campo entre aspas.
        if (ch === '"') {
            // Trata aspas duplicadas como uma aspa literal dentro do campo.
            if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
            // Continua para o próximo caractere após tratar a aspa.
            continue;
        }
        // Usa a vírgula como separador apenas fora de campos entre aspas.
        if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; continue; }
        // Acrescenta o caractere à célula atual.
        cur += ch;
    }
    // Adiciona a última célula, que não termina com uma vírgula.
    result.push(cur);
    // Remove espaços extras do início e do fim de cada valor.
    return result.map(s => s.trim());
}

// Função que realiza a busca de produtos com base no termo digitado pelo usuário
function searchProducts() {
    // Pega o valor do campo de busca e converte para minúsculas para busca case-insensitive
    const termo = document.getElementById("searchInput").value.toLowerCase();
    // Filtra o array de produtos verificando se o nome ou descrição contém o termo
    const resultados = produtos.filter(p =>
        p.nome.toLowerCase().includes(termo) ||
        p.descricao.toLowerCase().includes(termo)
    );
    // Renderiza na página os produtos que atenderam ao filtro de busca
    renderProducts(resultados);
}

// Função que aplica filtros por categoria e faixa de preço
function applyFilters() {
    // Lê o valor selecionado no select de categorias
    const categoria = document.getElementById("categoryFilter").value;
    // Converte os valores de preço para números, usando 0 e Infinity como padrão
    const min = parseFloat(document.getElementById("minPrice").value) || 0;
    const max = parseFloat(document.getElementById("maxPrice").value) || Infinity;
    // Filtra os produtos observando categoria (se informada) e faixa de preço
    const filtrados = produtos.filter(p =>
        (categoria === "" || p.categoria === categoria) &&
        p.preco >= min && p.preco <= max
    );
    // Renderiza os produtos filtrados
    renderProducts(filtrados);
}

// Função que renderiza uma lista de produtos dentro do container #productList
function renderProducts(lista) {
    // Obtém o elemento onde os produtos serão inseridos
    const container = document.getElementById("productList");
    // Interrompe a renderização se a página não tiver uma lista de produtos.
    if (!container) return;
    // Limpa o conteúdo atual para re-renderizar
    container.innerHTML = "";
    // Itera sobre cada produto da lista e cria o HTML correspondente
    lista.forEach(p => {
        // Acrescenta ao conteúdo HTML uma card com imagem, nome, descrição, preço,
        // categoria e um botão para adicionar ao carrinho. Usamos template string
        // para interpolar as propriedades do objeto produto.
        // Normaliza nome de arquivo para tentar encontrar imagens com e sem espaços/acentos
        const imagemNome = (p.imagem || '').replace(/\s+/g, ' ').trim();
        // Monta o caminho da imagem ou escolhe uma imagem padrão se não houver uma definida.
        const imagemPath = imagemNome ? `imagem_bola_08/${imagemNome}` : 'imagem_bola_08/default.png';
        // Cria estrutura via DOM para permitir onerror no <img>
        // Cria o cartão que vai conter os dados do produto.
        const card = document.createElement('div');
        // Atribui ao cartão a classe usada para sua aparência no CSS.
        card.className = 'produto';
        // Cria a imagem do produto.
        const img = document.createElement('img');
        // Define o arquivo de imagem a ser exibido.
        img.src = imagemPath;
        // Define o texto alternativo da imagem para acessibilidade.
        img.alt = p.nome;
        // Usa a imagem padrão caso a imagem do produto não possa ser carregada.
        img.onerror = function() { this.src = 'imagem_bola_08/default.png'; };
        // Cria o título do produto e insere seu nome como texto.
        const h3 = document.createElement('h3'); h3.textContent = p.nome;
        // Cria o parágrafo com a descrição do produto.
        const descr = document.createElement('p'); descr.textContent = p.descricao;
        // Cria o parágrafo do preço, formatado com duas casas decimais.
        const precoP = document.createElement('p'); precoP.textContent = `R$ ${p.preco.toFixed(2)}`;
        // Cria o parágrafo que informa a categoria.
        const catP = document.createElement('p'); catP.textContent = `Categoria: ${p.categoria}`;
        // Cria o botão para adicionar o produto ao carrinho.
        const btn = document.createElement('button'); btn.textContent = 'Adicionar ao Carrinho';
        // Liga o botão à função que informa a adição ao carrinho.
        btn.onclick = () => adicionarAoCarrinho(p.nome);
        // Insere a imagem no cartão.
        card.appendChild(img);
        // Insere o nome no cartão.
        card.appendChild(h3);
        // Insere a descrição no cartão.
        card.appendChild(descr);
        // Insere o preço no cartão.
        card.appendChild(precoP);
        // Insere a categoria no cartão.
        card.appendChild(catP);
        // Insere o botão no cartão.
        card.appendChild(btn);
        // Adiciona o cartão completo à lista de produtos na página.
        container.appendChild(card);
    });
}

// Preenche o select de categorias com as categorias únicas encontradas
function populateCategoryFilter() {
    // Seleciona o campo de categorias da página.
    const select = document.getElementById('categoryFilter');
    // Evita preencher um filtro que não existe nesta página.
    if (!select) return;
    // Remove quaisquer opções além da primeira (Todas as Categorias)
    while (select.options.length > 1) select.remove(1);
    // Obtém as categorias preenchidas, sem duplicatas ou valores vazios.
    const categorias = Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean)));
    // Organiza as categorias em ordem alfabética.
    categorias.sort();
    // Cria uma opção no campo para cada categoria encontrada.
    categorias.forEach(cat => {
        // Cria uma nova opção do menu.
        const opt = document.createElement('option');
        // Define o valor usado pelo filtro.
        opt.value = cat;
        // Define o texto que aparece para o usuário.
        opt.textContent = cat;
        // Adiciona a opção ao campo de categorias.
        select.appendChild(opt);
    });
}

// Adiciona o produto à conta conectada e trata falhas de autenticação.
async function adicionarAoCarrinho(nome) {
    // Tenta salvar uma unidade do produto no carrinho do servidor.
    try {
        // Envia para a API o nome do produto que será adicionado.
        await window.accountApi('cart_add', { name: nome });
        // Confirma visualmente que o produto foi salvo.
        alert(`Produto ${nome} adicionado ao carrinho.`);
    // Trata falhas retornadas pelo servidor.
    } catch (error) {
        // Redireciona para a tela de entrada quando não há conta conectada.
        if (error.status === 401) {
            // Abre a tela de conta e informa a página de retorno.
            window.location.href = 'login.html?redirect=index.html';
            // Encerra o tratamento após redirecionar.
            return;
        }
        // Mostra ao usuário qualquer outra falha na ação.
        alert(error.message);
    }
}

// Busca os itens salvos e monta visualmente o carrinho da conta atual.
async function carregarCarrinho() {
    // Encontra a área que receberá a lista de produtos.
    const container = document.getElementById('cartItems');
    // Encontra o espaço usado para mensagens de estado e erro.
    const message = document.getElementById('cartMessage');
    // Encontra o espaço em que o total será apresentado.
    const totalElement = document.getElementById('cartTotal');
    // Encontra o botão que informa sobre a finalização.
    const checkoutButton = document.getElementById('checkoutButton');

    // Trata erros que possam acontecer ao consultar os dados.
    try {
        // Busca ao mesmo tempo o carrinho da conta e o catálogo de produtos.
        const [cartData, productsResponse] = await Promise.all([
            // Pede à API o carrinho pertencente à sessão conectada.
            window.accountApi('cart_get'),
            // Carrega do servidor a lista atual de produtos.
            fetch('importar_csv.php')
        ]);
        // Interrompe se o servidor não conseguiu entregar o catálogo.
        if (!productsResponse.ok) throw new Error('Não foi possível carregar os produtos.');
        // Converte a resposta do catálogo em dados JavaScript.
        const productData = await productsResponse.json();
        // Confirma que o catálogo recebido é uma lista.
        if (!Array.isArray(productData)) throw new Error('A lista de produtos é inválida.');
        // Prepara os produtos com os mesmos dados usados pela página principal.
        setProdutosFromData(productData);

        // Remove os itens antigos antes de exibir os atuais.
        container.replaceChildren();
        // Inicializa o valor total do carrinho.
        let total = 0;
        // Transforma os itens do carrinho em pares de nome e quantidade.
        const entries = Object.entries(cartData.cart);

        // Mostra uma mensagem e desativa a finalização se não houver itens.
        if (entries.length === 0) {
            // Informa que a conta ainda não tem produtos no carrinho.
            message.textContent = 'Seu carrinho está vazio.';
            // Apaga qualquer valor total anterior.
            totalElement.textContent = '';
            // Desativa o botão quando não existem itens para finalizar.
            checkoutButton.disabled = true;
            // Encerra o carregamento do carrinho vazio.
            return;
        }

        // Limpa mensagem anterior antes de apresentar os itens.
        message.textContent = '';
        // Cria um cartão para cada produto salvo.
        entries.forEach(([name, quantity]) => {
            // Procura no catálogo os dados do produto salvo.
            const product = produtos.find(item => item.nome === name);
            // Ignora o item se o produto não existir mais no catálogo.
            if (!product) return;

            // Cria o elemento que agrupa as informações do produto.
            const item = document.createElement('article');
            // Aplica o estilo de cartão de produto do carrinho.
            item.className = 'cart-item';
            // Cria o agrupamento do nome e da quantidade.
            const description = document.createElement('div');
            // Cria um título para o nome do produto.
            const title = document.createElement('h3');
            // Insere o nome do produto como texto seguro.
            title.textContent = product.nome;
            // Cria a descrição da quantidade e do preço unitário.
            const details = document.createElement('p');
            // Apresenta a quantidade e o preço formatado do produto.
            details.textContent = `${quantity} unidade(s) × R$ ${product.preco.toFixed(2)}`;
            // Agrupa o título e a descrição do produto.
            description.append(title, details);

            // Cria o botão usado para remover este produto do carrinho.
            const removeButton = document.createElement('button');
            // Evita que o botão envie um formulário.
            removeButton.type = 'button';
            // Define o texto visível do botão.
            removeButton.textContent = 'Remover';
            // Executa a remoção quando o botão for clicado.
            removeButton.addEventListener('click', async () => {
                // Trata possíveis falhas ao remover o produto.
                try {
                    // Pede à API para remover o produto da conta atual.
                    await window.accountApi('cart_remove', { name });
                    // Atualiza a lista para refletir o carrinho salvo.
                    await carregarCarrinho();
                // Informa na página se a remoção falhar.
                } catch (error) {
                    // Mostra a mensagem de erro na área de mensagens.
                    setAccountMessage(message, error.message, true);
                }
            });

            // Soma ao total o preço do produto multiplicado por sua quantidade.
            total += product.preco * quantity;
            // Agrupa as informações e o botão dentro do cartão.
            item.append(description, removeButton);
            // Insere o cartão na lista visível do carrinho.
            container.appendChild(item);
        });

        // Trata o caso em que todos os produtos salvos saíram do catálogo.
        if (container.childElementCount === 0) {
            // Informa que os produtos salvos não estão mais disponíveis.
            message.textContent = 'Os produtos salvos não estão mais disponíveis.';
            // Remove um total que não pode mais ser calculado.
            totalElement.textContent = '';
            // Desativa a finalização porque não há produtos válidos.
            checkoutButton.disabled = true;
        } else {
            // Habilita o botão informativo quando há produtos válidos.
            checkoutButton.disabled = false;
        }
        // Apresenta o valor calculado para todos os produtos.
        totalElement.textContent = `Total: R$ ${total.toFixed(2)}`;
    // Trata falhas ao carregar o carrinho ou o catálogo.
    } catch (error) {
        // Mostra uma opção de login quando a sessão não está autenticada.
        if (error.status === 401) {
            // Informa que é preciso entrar para consultar o carrinho.
            setAccountMessage(message, 'Entre na sua conta para ver seu carrinho.');
            // Cria um link que leva de volta ao carrinho após entrar.
            const loginLink = document.createElement('a');
            // Define a tela de login e a página de retorno.
            loginLink.href = 'login.html?redirect=cart.html';
            // Define o texto do link.
            loginLink.textContent = 'Entrar';
            // Coloca o link junto da mensagem de autenticação.
            message.append(' ', loginLink);
            // Desativa a finalização sem autenticação.
            checkoutButton.disabled = true;
            // Encerra o tratamento após apresentar o link.
            return;
        }
        // Apresenta qualquer outra falha na página.
        setAccountMessage(message, error.message, true);
        // Desativa o botão enquanto o carrinho não puder ser verificado.
        checkoutButton.disabled = true;
    }
}

// Informa que a finalização ainda não está configurada como compra real.
function finalizarCompra() {
    // Encontra a área em que a informação será apresentada.
    const message = document.getElementById('cartMessage');
    // Informa que o carrinho continua salvo para não sugerir uma compra concluída.
    setAccountMessage(message, 'A finalização da compra ainda não está disponível. Seu carrinho continua salvo.');
}

// Aguarda a página carregar antes de ligar o botão de finalização.
window.addEventListener('DOMContentLoaded', () => {
    // Encontra o botão da página de carrinho.
    const checkoutButton = document.getElementById('checkoutButton');
    // Liga o botão à mensagem de finalização quando ele existir.
    if (checkoutButton) checkoutButton.addEventListener('click', finalizarCompra);
});
