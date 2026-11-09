
// Array que armazenará os produtos carregados (inicialmente vazio)
let produtos = [];

// Ao carregar a página, busca os produtos no servidor (importar_csv.php)
window.addEventListener('DOMContentLoaded', () => {
    // Tenta primeiro usar o endpoint PHP que retorna JSON
    fetch('importar_csv.php')
        .then(res => {
            if (!res.ok) throw new Error('Resposta não OK');
            return res.json();
        })
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) throw new Error('JSON vazio ou inválido');
            setProdutosFromData(data);
        })
        .catch(err => {
            console.warn('Falha ao carregar JSON via PHP, tentando CSV client-side:', err);
            // Fallback: tenta carregar o CSV diretamente (útil se não estiver rodando via servidor PHP)
            fetch('Produtos inteligentes.csv')
                .then(r => {
                    if (!r.ok) throw new Error('Não foi possível carregar produtos.csv');
                    return r.text();
                })
                .then(text => {
                    const parsed = parseCSV(text);
                    setProdutosFromData(parsed);
                })
                .catch(err2 => {
                    console.error('Erro ao carregar produtos via CSV:', err2);
                });
        });
});

// Normaliza e seta o array global a partir de dados brutos (JSON ou CSV parsed)
function setProdutosFromData(data) {
    produtos = data.map(p => ({
        nome: (p.nome || '').toString().trim(),
        descricao: (p.descricao || '').toString().trim(),
        preco: parseFloat((p.preco || 0).toString().replace(/[^0-9,]/g, '').replace(',', '.')) || 0,
        imagem: (p.imagem || '').toString().trim(),
        categoria: (p.categoria || '').toString().trim()
    }));
    populateCategoryFilter();
    renderProducts(produtos);
}

// Parser simples de CSV que entende aspas ("...") e vírgulas internas
function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
    if (lines.length <= 1) return [];
    const header = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(l => parseCSVLine(l));
    const result = [];
    rows.forEach(cols => {
        if (cols.length < header.length) return; // pula linhas incompletas
        const obj = {};
        for (let i = 0; i < header.length; i++) {
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
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
            continue;
        }
        if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; continue; }
        cur += ch;
    }
    result.push(cur);
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
        const imagemPath = imagemNome ? `imagem_bola_08/${imagemNome}` : 'imagem_bola_08/default.png';
        // Cria estrutura via DOM para permitir onerror no <img>
        const card = document.createElement('div');
        card.className = 'produto';
        const img = document.createElement('img');
        img.src = imagemPath;
        img.alt = p.nome;
        img.onerror = function() { this.src = 'imagem_bola_08/default.png'; };
        const h3 = document.createElement('h3'); h3.textContent = p.nome;
        const descr = document.createElement('p'); descr.textContent = p.descricao;
        const precoP = document.createElement('p'); precoP.textContent = `R$ ${p.preco.toFixed(2)}`;
        const catP = document.createElement('p'); catP.textContent = `Categoria: ${p.categoria}`;
        const btn = document.createElement('button'); btn.textContent = 'Adicionar ao Carrinho';
        btn.onclick = () => adicionarAoCarrinho(p.nome);
        card.appendChild(img);
        card.appendChild(h3);
        card.appendChild(descr);
        card.appendChild(precoP);
        card.appendChild(catP);
        card.appendChild(btn);
        container.appendChild(card);
    });
}

// Preenche o select de categorias com as categorias únicas encontradas
function populateCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    // Remove quaisquer opções além da primeira (Todas as Categorias)
    while (select.options.length > 1) select.remove(1);
    const categorias = Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean)));
    categorias.sort();
    categorias.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
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
    alert("Compra finalizada com sucesso!");
}
