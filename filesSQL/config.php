<?php
// ============================================================
//  CONFIGURATION BASE DE DONNÉES
//  Modifiez ces valeurs avant de déployer
// ============================================================

define('DB_HOST',     'db5000115700.hosting-data.io');       // Hôte MySQL (souvent localhost)
define('DB_PORT',     '3306');            // Port MySQL (3306 par défaut)
define('DB_NAME',     'dbs110226');     // Nom de la base de données
define('DB_USER',     'dbu182451');            // Utilisateur MySQL
define('DB_PASS',     '11235813@ppJS');                // Mot de passe MySQL
define('DB_CHARSET',  'utf8mb4');         // Encodage (ne pas modifier)

// ============================================================
//  OPTIONS DE L'APPLICATION
// ============================================================

define('APP_TITLE',        'App Gallery');          // Titre affiché
define('APP_SUBTITLE',     'Collection d\'apps HTML interactives');
define('ITEMS_PER_PAGE',   20);                     // Nombre d'apps par page
define('ALLOWED_ORIGINS',  '*');                    // CORS (mettez votre domaine en prod)

// ============================================================
//  NE PAS MODIFIER EN DESSOUS
// ============================================================

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
        );
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode([
                'error' => 'Connexion base de données impossible.',
                'detail' => $e->getMessage()
            ]));
        }
    }
    return $pdo;
}

function jsonResponse(mixed $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGINS);
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}
