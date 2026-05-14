<?php
// ============================================================
//  INSTALL.PHP — Création de la base de données
//  Exécutez ce script UNE SEULE FOIS pour initialiser la BDD
//  Puis supprimez-le du serveur pour des raisons de sécurité
// ============================================================

require_once 'config.php';

$pdo = getDB();

// Création de la table apps
$pdo->exec("
    CREATE TABLE IF NOT EXISTS apps (
        id          CHAR(16)        NOT NULL PRIMARY KEY,
        name        VARCHAR(255)    NOT NULL,
        url         TEXT            NOT NULL,
        description TEXT            DEFAULT NULL,
        tags        JSON            DEFAULT NULL,
        thumbnail   TEXT            DEFAULT NULL,
        created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// Données d'exemple (optionnel — supprimez ce bloc si vous ne voulez pas d'exemple)
$count = $pdo->query("SELECT COUNT(*) FROM apps")->fetchColumn();
if ($count == 0) {
    $stmt = $pdo->prepare("
        INSERT INTO apps (id, name, url, description, tags)
        VALUES (:id, :name, :url, :desc, :tags)
    ");
    $stmt->execute([
        'id'   => bin2hex(random_bytes(8)),
        'name' => 'Exemple : COSMOS',
        'url'  => 'https://example.com',
        'desc' => 'Application exemple — remplacez par votre vraie URL',
        'tags' => json_encode(['démo', 'Three.js'])
    ]);
}

echo "
<!DOCTYPE html>
<html lang='fr'>
<head>
<meta charset='UTF-8'>
<title>Installation App Gallery</title>
<style>
  body { font-family: monospace; background: #0d0d0d; color: #e8e4dc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { background: #141414; border: 1px solid #2a2a2a; border-radius: 4px; padding: 2rem 2.5rem; max-width: 500px; width: 100%; }
  h1 { font-size: 1.4rem; margin-bottom: 1rem; color: #1D9E75; }
  p { font-size: 13px; color: #888; line-height: 1.7; margin: 0.5rem 0; }
  code { background: #0d0d0d; padding: 2px 8px; border-radius: 2px; color: #9fe1cb; font-size: 12px; }
  .warn { color: #EF9F27; margin-top: 1.5rem; font-size: 12px; }
  a { color: #9fe1cb; }
</style>
</head>
<body>
<div class='box'>
  <h1>✓ Installation réussie</h1>
  <p>La table <code>apps</code> a été créée dans la base <code>" . DB_NAME . "</code>.</p>
  <p>Vous pouvez maintenant ouvrir <a href='index.html'>index.html</a> pour utiliser la galerie.</p>
  <p class='warn'>⚠ Supprimez ce fichier <code>install.php</code> de votre serveur pour des raisons de sécurité.</p>
</div>
</body>
</html>
";
