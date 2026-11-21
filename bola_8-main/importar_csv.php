<?php
// Inicializa um array vazio para armazenar os produtos lidos do CSV
$produtos = [];

// Tenta abrir o arquivo 'Produtos inteligentes.csv' para leitura
if (($handle = fopen("Produtos inteligentes.csv", "r")) !== FALSE) {
    // Lê a primeira linha (cabeçalho) e descarta
    fgetcsv($handle, 1000, ",");
    // Loop enquanto houver linhas no CSV
    while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
        // Protege contra linhas vazias/curtas
        if (count($data) < 5) continue;
        // Mapeia os campos da linha para um array associativo representando o produto
        $imagemNome = $data[3];
        // Tenta encontrar arquivo existente na pasta Imagens com correspondência tolerante
        $imagensDir = __DIR__ . DIRECTORY_SEPARATOR . 'imagem_bola_08';
        if (is_dir($imagensDir)) {
            $files = scandir($imagensDir);
            $found = null;
            // Normaliza string para comparação
            $normalize = function($s) {
                $s = mb_strtolower(trim($s));
                $s = iconv('UTF-8', 'ASCII//TRANSLIT', $s);
                $s = preg_replace('/[^a-z0-9\.]/', '', $s);
                return $s;
            };
            $target = $normalize($imagemNome);
            foreach ($files as $f) {
                if (in_array($f, array('.', '..'))) continue;
                if ($normalize($f) === $target) { $found = $f; break; }
            }
            if ($found) $imagemNome = $found;
        }
        $produtos[] = [
            "nome" => $data[0],
            "descricao" => $data[1],
            "preco" => $data[2],
            "imagem" => $imagemNome,
            "categoria" => $data[4]
        ];
    }
    // Fecha o arquivo após a leitura
    fclose($handle);
}

// Define o header para JSON com charset
header('Content-Type: application/json; charset=utf-8');
// Retorna o array de produtos no formato JSON (útil para consumo via AJAX)
echo json_encode($produtos);
?>
