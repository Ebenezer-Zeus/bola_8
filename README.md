# 🎱 Bola 8 — Produtos para Casa Inteligente

Projeto acadêmico desenvolvido em grupo para a faculdade: uma loja virtual de produtos para automação residencial (casa inteligente), como interruptores Wi‑Fi, fechaduras digitais, câmeras de segurança, lâmpadas smart e outros.

## ✨ Funcionalidades

- **Vitrine de produtos** carregada a partir de um arquivo CSV (`Produtos inteligentes.csv`), com imagem, nome, descrição, preço e categoria.
- **Busca** por nome ou descrição do produto.
- **Filtros** por categoria e por faixa de preço (mínimo e máximo).
- **Cadastro e login** de usuários, com senha armazenada em hash e sessão protegida.
- **Carrinho de compras** individual por conta: adicionar, remover e ver o total.

## 🛠️ Tecnologias

- **HTML5** e **CSS3** — estrutura e visual das páginas
- **JavaScript** — busca, filtros, montagem dos cards e comunicação com o servidor
- **PHP** — leitura do CSV, API de contas (cadastro, login, logout) e carrinho
- **CSV/JSON** — armazenamento dos produtos e das contas (sem banco de dados)

## 📁 Estrutura

```
bola_8-main/
├── index.html                  # Página principal (vitrine)
├── login.html                  # Tela de login e cadastro
├── cart.html                   # Carrinho de compras
├── styles.css                  # Estilos do site
├── scripts.js                  # Vitrine, busca, filtros e carrinho
├── account.js                  # Sessão e comunicação com a API de contas
├── importar_csv.php            # Lê o CSV e devolve os produtos em JSON
├── account_api.php             # API de cadastro, login e carrinho
├── Produtos inteligentes.csv   # Catálogo de produtos
└── imagem_bola_08/             # Imagens dos produtos
```

## ▶️ Como executar

O projeto precisa de um servidor com PHP. Abrir o `index.html` direto no navegador (dois cliques) **não** carrega os produtos.

**Com XAMPP:**
1. Coloque a pasta do projeto em `C:\xampp\htdocs\`.
2. Abra o XAMPP Control Panel e inicie o **Apache**.
3. Acesse `http://localhost/bola_8-main/` no navegador.

**Ou pelo terminal (com PHP instalado):**
```bash
php -S localhost:8000
```
E acesse `http://localhost:8000`.

> As contas de usuário são salvas em um arquivo `accounts.json` dentro da pasta `bola_8_data`, criada automaticamente fora da pasta pública do site.

## 👥 Autores

- Luis Leandro S.
- Ebenezer Santos
- Luan Pires
