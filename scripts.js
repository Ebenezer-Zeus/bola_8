
// Array que armazenará os produtos carregados (inicialmente vazio)
let produtos = [];

// Ao carregar a página, busca os produtos no servidor (importar_csv.php)
window.addEventListener('DOMContentLoaded', () => {
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

// Função chamada ao clicar no botão "Adicionar ao Carrinho"; atualmente apenas mostra um alerta
function adicionarAoCarrinho(nome) {
    // Mensagem simples indicando que o produto foi adicionado
    alert(`Produto ${nome} adicionado ao carrinho.`);
}

// Função para finalizar a compra; atualmente mostra apenas um alerta de confirmação
function finalizarCompra() {
    // Exibe uma mensagem de confirmação da compra.
    alert("Compra finalizada com sucesso!");
}
