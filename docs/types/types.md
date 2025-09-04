# Documentation - Types et Interfaces

## Connection.ts

### Vue d'ensemble
Le fichier `Connection.ts` définit les interfaces TypeScript essentielles pour la gestion des connexions de base de données, les formulaires et les métadonnées des tables. Il constitue le système de typage central de l'extension.

---

## Interfaces Définies

### `DatabaseConnection`

**Rôle** : Interface principale représentant une connexion de base de données configurée et persistante.

**Propriétés** :

```typescript
interface DatabaseConnection {
    id: string;                    // Identifiant unique de la connexion
    name: string;                  // Nom d'affichage personnalisé
    host: string;                  // Adresse du serveur de base de données
    port: number;                  // Port de connexion (défaut: 3306 pour MySQL)
    username: string;              // Nom d'utilisateur pour l'authentification
    password: string;              // Mot de passe (stocké de façon sécurisée)
    database?: string;             // Base de données par défaut (optionnelle)
    type: 'mysql' | 'mariadb';     // Type de SGBD supporté
    isConnected?: boolean;         // État de connexion actuel (optionnel)
    lastConnected?: Date;          // Timestamp de dernière connexion (optionnel)
}
```

**Détails des propriétés** :

- **`id`** : UUID généré automatiquement, utilisé comme clé unique pour le stockage et la récupération
- **`name`** : 
  - Nom affiché dans l'interface utilisateur
  - Auto-généré selon la logique : `Database.Host` ou `Host` si database vide
  - Modifiable manuellement par l'utilisateur
- **`host`** : 
  - Adresse IP (ex: `192.168.1.100`) ou nom de domaine (ex: `localhost`, `db.example.com`)
  - Validation côté client pour format correct
- **`port`** : 
  - Port TCP pour la connexion MySQL/MariaDB
  - Valeur par défaut : 3306
- **`username`** / **`password`** :
  - Credentials d'authentification MySQL
  - Le mot de passe est stocké dans les secrets VS Code (sécurisé)
- **`database`** : 
  - Base de données par défaut à utiliser
  - Optionnel : si vide, l'utilisateur peut choisir après connexion
- **`type`** : 
  - Différenciation entre MySQL et MariaDB
  - Utilisé pour des comportements spécifiques si nécessaire
- **`isConnected`** : 
  - État temps réel de la connexion
  - Utilisé pour l'affichage des icônes dans l'arbre
- **`lastConnected`** :
  - Métadonnée pour le suivi d'utilisation
  - Affichage de l'historique des connexions

---

### `ConnectionFormData`

**Rôle** : Interface pour les données du formulaire de création/édition de connexion.

**Propriétés** :

```typescript
interface ConnectionFormData {
    name: string;                  // Nom de connexion (champ texte)
    host: string;                  // Serveur (champ texte)
    port: string;                  // Port (champ texte, converti en number)
    username: string;              // Utilisateur (champ texte)
    password: string;              // Mot de passe (champ password)
    database: string;              // Base de données (champ texte)
    type: 'mysql' | 'mariadb';     // Type (sélecteur dropdown)
}
```

**Différences avec `DatabaseConnection`** :

- **`port`** : String dans le formulaire, number dans la connexion finale
- **Pas d'`id`** : Généré automatiquement lors de la sauvegarde
- **Pas de métadonnées** : `isConnected`, `lastConnected` non applicables
- **Tous les champs obligatoires** : Validation côté client

**Utilisation** :
1. **Saisie utilisateur** : Webview → `ConnectionFormData`
2. **Validation** : Contrôles de format et d'intégrité
3. **Transformation** : `ConnectionFormData` → `DatabaseConnection`
4. **Persistance** : Stockage via `ConnectionManager`

---

### `TableInfo`

**Rôle** : Interface représentant les métadonnées complètes d'une table de base de données.

**Propriétés** :

```typescript
interface TableInfo {
    name: string;                  // Nom de la table
    columns: ColumnInfo[];         // Liste des colonnes avec détails
}
```

**Utilisation** :
- **Récupération** : Via `DatabaseService.getTableInfo()`
- **Génération DAO** : Analyse des colonnes pour créer les classes PHP
- **Interface utilisateur** : Affichage des détails de table

---

### `ColumnInfo`

**Rôle** : Interface détaillée pour une colonne de table de base de données.

**Propriétés** :

```typescript
interface ColumnInfo {
    name: string;                  // Nom de la colonne
    type: string;                  // Type de données MySQL (VARCHAR, INT, etc.)
    nullable: boolean;             // NULL autorisé ou non
    key: 'PRI' | 'UNI' | 'MUL' | '';  // Type de clé/index
    default: string | null;        // Valeur par défaut
    extra: string;                 // Informations supplémentaires (AUTO_INCREMENT, etc.)
}
```

**Détails des propriétés** :

- **`name`** : 
  - Nom exact de la colonne en base
  - Utilisé pour générer les propriétés PHP et les mappings
- **`type`** : 
  - Type MySQL complet (ex: `VARCHAR(255)`, `INT(11)`, `DATETIME`)
  - Analysé pour déterminer le type PHP correspondant
- **`nullable`** : 
  - `true` si `NULL` autorisé, `false` si `NOT NULL`
  - Influence la validation côté PHP
- **`key`** :
  - `'PRI'` : Clé primaire
  - `'UNI'` : Index unique  
  - `'MUL'` : Index multiple (non unique)
  - `''` : Pas d'index
- **`default`** :
  - Valeur par défaut de la colonne
  - `null` si pas de valeur par défaut
  - String même pour les valeurs numériques
- **`extra`** :
  - Informations MySQL additionnelles
  - Exemples : `'AUTO_INCREMENT'`, `'on update CURRENT_TIMESTAMP'`

---

## Mapping vers PHP

### Types de données
Le générateur DAO utilise ces informations pour mapper les types MySQL vers PHP :

```
MySQL VARCHAR/TEXT/CHAR → PHP string
MySQL INT/BIGINT/SMALLINT → PHP int  
MySQL FLOAT/DOUBLE/DECIMAL → PHP float
MySQL DATETIME/TIMESTAMP → PHP string (format ISO)
MySQL BOOLEAN/TINYINT(1) → PHP bool
```

### Clés primaires
- Les colonnes avec `key: 'PRI'` deviennent les identifiants dans les méthodes CRUD
- Auto-détection pour les méthodes `findById()`, `updateById()`, `deleteById()`

### Contraintes NULL
- `nullable: false` → Validation obligatoire dans les setters PHP
- `nullable: true` → Valeurs optionnelles autorisées

---

## Évolution et extensibilité

**PostgreSQL Support** : Ajout possible de `type: 'postgresql'` dans `DatabaseConnection`

**Types de colonnes avancés** : Extension de `ColumnInfo` pour JSON, ENUM, etc.

**Métadonnées de table** : Extension de `TableInfo` avec engine, charset, etc.

**Validations complexes** : Ajout d'interfaces pour les contraintes foreign key, check constraints, etc.
