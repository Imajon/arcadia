<?php
// ============================================================
//  API.PHP — API REST pour la galerie d'apps
//  Routes :
//    GET    api.php          → liste toutes les apps
//    POST   api.php          → créer une app
//    PUT    api.php?id=xxx   → modifier une app
//    DELETE api.php?id=xxx   → supprimer une app
//    GET    api.php?export=1 → exporter tout en JSON
//    POST   api.php?import=1 → importer un tableau JSON
// ============================================================

require_once 'config.php';

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGINS);
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']     ?? null;
$export = isset($_GET['export']);
$import = isset($_GET['import']);

// ── GET : liste ou export ─────────────────────────────────
if ($method === 'GET') {
    $pdo = getDB();

    if ($export) {
        $apps = $pdo->query("SELECT * FROM apps ORDER BY created_at DESC")->fetchAll();
        foreach ($apps as &$a) {
            $a['tags'] = json_decode($a['tags'] ?? '[]');
        }
        jsonResponse($apps);
    }

    $search = trim($_GET['q'] ?? '');
    $tag    = trim($_GET['tag'] ?? '');

    $where  = [];
    $params = [];

    if ($search !== '') {
        $where[]          = "(name LIKE :s OR description LIKE :s2)";
        $params[':s']     = '%' . $search . '%';
        $params[':s2']    = '%' . $search . '%';
    }
    if ($tag !== '') {
        $where[]         = "JSON_CONTAINS(tags, :tag)";
        $params[':tag']  = json_encode($tag);
    }

    $sql = "SELECT * FROM apps";
    if ($where) $sql .= " WHERE " . implode(" AND ", $where);
    $sql .= " ORDER BY created_at DESC LIMIT " . (int)ITEMS_PER_PAGE;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $apps = $stmt->fetchAll();
    foreach ($apps as &$a) {
        $a['tags'] = json_decode($a['tags'] ?? '[]');
    }
    jsonResponse($apps);
}

// ── POST : créer ou importer ──────────────────────────────
if ($method === 'POST') {
    $pdo  = getDB();
    $body = getBody();

    // Import en masse
    if ($import) {
        if (!is_array($body)) jsonResponse(['error' => 'Tableau JSON attendu.'], 400);
        $stmt = $pdo->prepare("
            INSERT IGNORE INTO apps (id, name, url, description, tags, created_at)
            VALUES (:id, :name, :url, :desc, :tags, :created_at)
        ");
        $inserted = 0;
        foreach ($body as $app) {
            if (empty($app['id']) || empty($app['name']) || empty($app['url'])) continue;
            $stmt->execute([
                ':id'         => $app['id'],
                ':name'       => $app['name'],
                ':url'        => $app['url'],
                ':desc'       => $app['description'] ?? $app['desc'] ?? null,
                ':tags'       => json_encode($app['tags'] ?? []),
                ':created_at' => $app['created_at'] ?? date('Y-m-d H:i:s'),
            ]);
            $inserted++;
        }
        jsonResponse(['inserted' => $inserted]);
    }

    // Création simple
    if (empty($body['name']) || empty($body['url'])) {
        jsonResponse(['error' => 'name et url sont requis.'], 400);
    }
    $newId = bin2hex(random_bytes(8));
    $stmt  = $pdo->prepare("
        INSERT INTO apps (id, name, url, description, tags)
        VALUES (:id, :name, :url, :desc, :tags)
    ");
    $stmt->execute([
        ':id'   => $newId,
        ':name' => $body['name'],
        ':url'  => $body['url'],
        ':desc' => $body['description'] ?? null,
        ':tags' => json_encode($body['tags'] ?? []),
    ]);
    $app = $pdo->query("SELECT * FROM apps WHERE id = '$newId'")->fetch();
    $app['tags'] = json_decode($app['tags'] ?? '[]');
    jsonResponse($app, 201);
}

// ── PUT : modifier ────────────────────────────────────────
if ($method === 'PUT') {
    if (!$id) jsonResponse(['error' => 'id manquant.'], 400);
    $pdo  = getDB();
    $body = getBody();

    $fields = [];
    $params = [':id' => $id];
    if (isset($body['name']))        { $fields[] = 'name = :name';        $params[':name'] = $body['name']; }
    if (isset($body['url']))         { $fields[] = 'url = :url';          $params[':url']  = $body['url']; }
    if (array_key_exists('description', $body)) { $fields[] = 'description = :desc'; $params[':desc'] = $body['description']; }
    if (isset($body['tags']))        { $fields[] = 'tags = :tags';        $params[':tags'] = json_encode($body['tags']); }

    if (!$fields) jsonResponse(['error' => 'Aucun champ à modifier.'], 400);

    $pdo->prepare("UPDATE apps SET " . implode(', ', $fields) . " WHERE id = :id")->execute($params);
    $app = $pdo->prepare("SELECT * FROM apps WHERE id = :id");
    $app->execute([':id' => $id]);
    $row = $app->fetch();
    if (!$row) jsonResponse(['error' => 'App introuvable.'], 404);
    $row['tags'] = json_decode($row['tags'] ?? '[]');
    jsonResponse($row);
}

// ── DELETE : supprimer ────────────────────────────────────
if ($method === 'DELETE') {
    if (!$id) jsonResponse(['error' => 'id manquant.'], 400);
    $pdo  = getDB();
    $stmt = $pdo->prepare("DELETE FROM apps WHERE id = :id");
    $stmt->execute([':id' => $id]);
    if ($stmt->rowCount() === 0) jsonResponse(['error' => 'App introuvable.'], 404);
    jsonResponse(['deleted' => $id]);
}

jsonResponse(['error' => 'Méthode non supportée.'], 405);
