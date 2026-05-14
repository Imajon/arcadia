# App Gallery — Version PHP/MySQL

Galerie d'applications HTML avec stockage MySQL.

## Fichiers

```
app-gallery-php/
├── config.php      ← ✏️  CONFIGUREZ ICI vos infos BDD
├── install.php     ← Exécuter une seule fois pour créer la table
├── api.php         ← API REST (ne pas modifier)
└── index.html      ← Interface de la galerie
```

## Installation

### 1. Configurer la base de données

Ouvrez `config.php` et renseignez vos informations :

```php
define('DB_HOST', 'localhost');      // Hôte MySQL
define('DB_PORT', '3306');           // Port
define('DB_NAME', 'app_gallery');    // Nom de la base (doit exister)
define('DB_USER', 'root');           // Utilisateur
define('DB_PASS', '');               // Mot de passe
```

> La base de données `app_gallery` doit déjà exister.  
> Créez-la avec : `CREATE DATABASE app_gallery CHARACTER SET utf8mb4;`

### 2. Créer la table

Déposez les fichiers sur votre serveur PHP, puis ouvrez dans un navigateur :

```
https://votre-site.com/install.php
```

Un message de confirmation s'affiche. **Supprimez ensuite install.php du serveur.**

### 3. Utiliser la galerie

Ouvrez `index.html` dans votre navigateur. L'API `api.php` est appelée automatiquement.

---

## Routes API

| Méthode | URL                    | Action                    |
|---------|------------------------|---------------------------|
| GET     | `api.php`              | Liste toutes les apps     |
| GET     | `api.php?q=mot`        | Recherche par mot-clé     |
| GET     | `api.php?export=1`     | Export JSON complet       |
| POST    | `api.php`              | Créer une app             |
| POST    | `api.php?import=1`     | Importer un tableau JSON  |
| PUT     | `api.php?id=xxx`       | Modifier une app          |
| DELETE  | `api.php?id=xxx`       | Supprimer une app         |

---

## Transfert entre serveurs

1. Cliquer **↓ Exporter JSON** sur l'ancien serveur
2. Sur le nouveau serveur, cliquer **↑ Importer JSON** et déposer le fichier
3. Les apps existantes ne sont pas dupliquées

## Prérequis serveur

- PHP 8.0+ avec extension PDO et pdo_mysql
- MySQL 5.7+ ou MariaDB 10.3+
