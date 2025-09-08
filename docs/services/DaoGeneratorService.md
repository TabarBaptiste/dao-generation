# Documentation - DaoGeneratorService.ts

## Vue d'ensemble

Le fichier `DaoGeneratorService.ts` constitue le cœur de génération automatique des classes DAO PHP dans l'extension. Il transforme les métadonnées de tables MySQL/MariaDB en classes PHP complètes avec méthodes CRUD, gestion de backups, et intégration avec l'architecture WAMP/projet PHP.

Ce service analyse la structure des tables, génère du code PHP optimisé avec mapping objet-relationnel automatique, et gère intelligemment les conflits de fichiers via des systèmes de sauvegarde ou d'écrasement selon les préférences utilisateur.

---

## Classe principale

### `DaoGeneratorService`

**Description générale** : Générateur automatique de classes DAO PHP à partir de métadonnées de base de données.

**Paramètres du constructeur** :
- `databaseService: DatabaseService` - Service d'accès aux données pour récupération des métadonnées de tables

**Variables principales** :
- `databaseService: DatabaseService` - Injection de dépendance vers le service de base de données

---

## Interface DaoGenerationOptions

**Définition** :
```typescript
interface DaoGenerationOptions {
    mode: 'save' | 'overwrite';     // Mode de gestion des fichiers existants
    outputPath?: string;            // Chemin de sortie optionnel
}
```

---

## Méthodes publiques

### `generateDaoFiles(connection, database, tableNames, options): Promise<void>`
**Paramètres** :
- `connection: DatabaseConnection` - Configuration de connexion à la base de données
- `database: string` - Nom de la base de données cible
- `tableNames: string[]` - Liste des tables pour lesquelles générer les DAO
- `options: DaoGenerationOptions` - Options de génération (mode save/overwrite, chemin)

**Valeur de retour** : `Promise<void>`

**Explication de la logique** :
1. **Sélection du dossier de sortie** : Via `getOutputFolder()` avec gestion spéciale WAMP
2. **Traitement par table** :
   - Récupération des métadonnées via `DatabaseService.getTableInfo()`
   - Génération du nom de fichier : `'DAO' + PascalCase(tableName) + '.php'`
   - Création du contenu DAO via `generateDaoContent()`
3. **Gestion des conflits** :
   - Mode 'save' : Création backup automatique puis écriture
   - Mode 'overwrite' : Écrasement direct sans backup
4. **Rapport final** : Statistiques détaillées avec proposition d'ouverture du dossier

**Exemple d'utilisation** :
```typescript
await daoGeneratorService.generateDaoFiles(
    connectionConfig,
    "my_database", 
    ["users", "products", "orders"],
    { mode: 'save', outputPath: "D:\\wamp64\\www\\myproject" }
);
```

---

## Méthodes privées

### `getOutputFolder(suggestedPath?: string): Promise<string | undefined>`
**Paramètres** :
- `suggestedPath?: string` - Chemin suggéré optionnel

**Explication de la logique** :
1. **Validation du chemin suggéré** : Vérification d'existence si fourni
2. **Détection environnement WAMP** : Priorité à `D:\wamp64\www` si existant
3. **Fallback workspace** : Utilise le workspace VS Code ouvert
4. **Dialogue utilisateur** : `showOpenDialog` avec chemin par défaut intelligent
5. **Gestion structure projet** :
   - **Projets WAMP** : Création automatique de `local/__classes/DAO/`  
   - **Autres projets** : Création simple de `DAO/`

**Valeur de retour** : Chemin du dossier DAO créé ou `undefined` si annulé

### `generateDaoContent(tableName, tableInfo, database, filePath?): string`
**Paramètres** :
- `tableName: string` - Nom complet de la table
- `tableInfo: TableInfo` - Métadonnées complètes de la table
- `database: string` - Nom de la base de données
- `filePath?: string` - Chemin du fichier pour calcul de version

**Explication de la logique** :
1. **Analyse de la table** :
   - Suppression du préfixe : `tableName.replace(/^[^_]+_/, '')`
   - Génération nom de classe : `'DAO' + PascalCase(cleanName)`
2. **Génération des composants** :
   - Attributs privés avec types PHP
   - Tableau de mapping objet-relationnel `$_t`
   - Accesseurs (getters/setters) automatiques
   - Méthodes CRUD (read, insert, update, delete)
3. **Gestion versioning** : Incrémentation automatique si fichier existant
4. **Template PHP complet** : Classe héritant de `Debug` avec documentation

**Valeur de retour** : Code PHP complet de la classe DAO

### `generateAttributes(columns: ColumnInfo[]): string`
**Explication de la logique** :
1. Parcourt toutes les colonnes de la table
2. Génère attributs privés PHP : `private $_{columnName};`
3. Ajoute commentaires de documentation avec types et contraintes
4. Mappage des types SQL vers types PHP

### `generateMappingArray(columns: ColumnInfo[]): string`  
**Explication de la logique** :
1. Crée le tableau associatif `$_t` pour mapping ORM
2. Format : `'column_name' => '$_{columnName}'`
3. Utilisé par les méthodes CRUD pour automatiser les requêtes

### `generateAccessors(columns: ColumnInfo[]): string`
**Explication de la logique** :
1. **Getters** : `public function get{PropertyName}() { return $this->_{columnName}; }`
2. **Setters** : `public function set{PropertyName}($value) { $this->_{columnName} = $value; }`
3. Conversion automatique PascalCase pour noms de méthodes
4. Documentation PHPDoc avec types

### `generateCrudMethods(tableNameWithoutPrefix, columns, database): string`
**Explication de la logique** :
1. **read()** : SELECT avec gestion ID primaire et debug
2. **insert()** : INSERT avec gestion de tous les champs sauf clé primaire  
3. **update()** : UPDATE basé sur clé primaire
4. **delete()** : DELETE avec paramètre ID optionnel
5. Utilise la variable globale `$_dbBridge` pour accès base
6. Gestion d'erreurs avec try/catch et debug

### Méthodes utilitaires

#### `createBackup(filePath: string): Promise<void>`
**Explication de la logique** :
1. Création dossier `backup/` dans le répertoire parent
2. Copie du fichier existant avec timestamp
3. Format : `filename_YYYY-MM-DD_HH-mm-ss.php`

#### `getNextVersion(filePath: string): string`
**Explication de la logique** :
1. Lecture du fichier existant
2. Extraction version actuelle via regex
3. Incrémentation automatique (1.00 → 1.01 → 1.02...)

#### `toPascalCase(str: string): string`
**Explication de la logique** : Conversion snake_case vers PascalCase pour noms de classes/méthodes

#### `mapSqlTypeToPhpType(sqlType: string): string`
**Mapping des types** :
```
INT/BIGINT/TINYINT → int
DECIMAL/FLOAT/DOUBLE → float  
BOOL/BOOLEAN → bool
DATE/TIME/DATETIME → string
DEFAULT → string
```

#### `findPrimaryKey(columns: ColumnInfo[]): ColumnInfo | null`
**Explication de la logique** : Recherche la colonne avec `key === 'PRI'`

### `showGenerationResult(generatedCount, skippedCount, errors, outputFolder, backupCount, generatedFiles): void`
**Explication de la logique** :
1. **Calcul des statistiques** : Fichiers générés, ignorés, erreurs, backups
2. **Messages utilisateur** :
   - Succès : `showInformationMessage`
   - Erreurs : `showWarningMessage` + canal de sortie détaillé
3. **Actions post-génération** :
   - "Ouvrir le dossier" → `revealFileInOS`
   - "Voir les backups" → Ouvre dossier backup
4. **Canal de sortie** : Logs détaillés pour débogage

---

## Liaisons avec d'autres fichiers

### Qui appelle ce fichier ?
- **`TableSelectionPanel.ts`** : Déclenche `generateDaoFiles()` lors de la validation du formulaire
- **`DatabaseConnectionProvider.ts`** : Via la commande context menu "Generate DAO"

### Quels fichiers il importe ou utilise
- **`vscode`** : API VS Code (dialogues, workspace, notifications, commandes)
- **`fs`** : Système de fichiers (lecture, écriture, vérification existence)
- **`path`** : Manipulation chemins (join, dirname, basename)
- **`../types/Connection`** : Interfaces DatabaseConnection, TableInfo, ColumnInfo
- **`./DatabaseService`** : Service d'accès aux métadonnées de base de données

---

## Logique/Algorithme clé

### Architecture de génération
1. **Analyse des métadonnées** : Table → Colonnes → Types → Contraintes
2. **Transformation** : SQL metadata → Structure PHP orientée objet
3. **Template engine** : Génération de code via templates string
4. **Pattern DAO** : Active Record avec méthodes CRUD standardisées

### Gestion intelligente des conflits
```
Fichier existant ?
├─ Mode 'save'
│  ├─ Créer backup avec timestamp
│  ├─ Incrémenter version dans header
│  └─ Écrire nouveau fichier
└─ Mode 'overwrite'  
   ├─ Incrémenter version
   └─ Écraser directement
```

### Intégration environnement WAMP
- **Détection automatique** : Vérification `D:\wamp64\www`
- **Structure standard** : `local/__classes/DAO/`
- **Fallback générique** : `DAO/` dans autres projets

### Pattern de mapping ORM
```php
// Génération automatique tableau mapping
$this->_t = array(
    'user_id' => '$_userId',
    'email' => '$_email',
    'created_at' => '$_createdAt'
);

// Utilisation dans méthodes CRUD
foreach ($this->_t as $key => $value) {
    $function = 'get' . substr($value, 3);
    $bind[$key] = $this->$function();
}
```

---

## Exemples d'utilisation

### Génération complète pour un projet
```typescript
// 1. Initialisation du service (extension.ts)
const daoGenerator = new DaoGeneratorService(databaseService);

// 2. Configuration de génération (TableSelectionPanel.ts)  
const options = {
    mode: 'save' as const,
    outputPath: "D:\\wamp64\\www\\myproject"
};

// 3. Génération pour tables sélectionnées
await daoGenerator.generateDaoFiles(
    connectionConfig,
    "ecommerce_db",
    ["users", "products", "orders", "categories"],
    options
);

// Résultat dans D:\wamp64\www\myproject\local\__classes\DAO\ :
// - DAOUsers.php
// - DAOProducts.php  
// - DAOOrders.php
// - DAOCategories.php
// + backup/ (si fichiers existants)
```

### Structure DAO générée (exemple table users)
```php
<?php
/**
 * Classe d'accès aux données -> table app_users
 * @version 1.00
 * @date 2024-01-15
 * @Create Généré automatiquement par PHP DAO Generator
 * @BDD ecommerce_db
 * @table app_users
 */

class DAOUsers extends Debug {
    private $_t;
    private $_userId;      // user_id (INT) - Clé primaire - Non null - AUTO_INCREMENT
    private $_email;       // email (VARCHAR(255)) - Unique - Non null
    private $_password;    // password (VARCHAR(255)) - Non null
    private $_createdAt;   // created_at (TIMESTAMP) - Non null - Défaut: CURRENT_TIMESTAMP

    public function __construct($id = 0, $debug = false) {
        $this->_t = array(
            'user_id' => '$_userId',
            'email' => '$_email',
            'password' => '$_password',
            'created_at' => '$_createdAt'
        );
        $this->setDebug($debug);
        $this->read($id, $debug);
    }

    // Accessors
    public function getUserId() { return $this->_userId; }
    public function setUserId($value) { $this->_userId = $value; }
    
    // ... autres accesseurs
    
    // CRUD Methods  
    public function read($id, $debug = false) { /* SELECT logic */ }
    public function insert() { /* INSERT logic */ }
    public function update() { /* UPDATE logic */ }
    public function delete($id = null) { /* DELETE logic */ }
}
```

### Intégration avec TableSelectionPanel
```typescript
// TableSelectionPanel.ts - Déclenchement génération
private async handleGenerate() {
    const selectedTables = this.getSelectedTables();
    const mode = this.getSelectedMode(); // 'save' ou 'overwrite'
    
    await this.daoGeneratorService.generateDaoFiles(
        this.connection,
        this.database, 
        selectedTables,
        { mode }
    );
}
```