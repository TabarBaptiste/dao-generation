# Documentation - ConnectionManager.ts

## Vue d'ensemble

Le fichier `ConnectionManager.ts` est le service central de gestion des connexions de base de données dans l'extension PHP DAO Generator. Il gère la persistance, la sécurité et le cycle de vie des connexions utilisateur, fournissant des opérations CRUD complètes avec chiffrement des mots de passe et fonctionnalités d'import/export.

Le service utilise l'API de stockage global de VS Code pour persister les connexions entre les sessions, avec un système de chiffrement AES-256-CBC pour la sécurité des mots de passe lors des exports.

---

## Classe principale

### `ConnectionManager`

**Description générale** : Gestionnaire principal des connexions de base de données avec persistance, sécurité et export/import.

**Paramètres du constructeur** :
- `context: vscode.ExtensionContext` - Contexte de l'extension VS Code pour accès au stockage global

**Variables principales** :
- `STORAGE_KEY: string` (static readonly) - Clé de stockage dans l'état global ('phpDaoGenerator.connections')
- `connections: DatabaseConnection[]` - Array des connexions en mémoire

---

## Méthodes publiques

### `getConnections(): DatabaseConnection[]`
**Paramètres** : Aucun
**Valeur de retour** : `DatabaseConnection[]` - Liste de toutes les connexions
**Explication de la logique** : Retourne directement le tableau des connexions en mémoire
**Exemple d'utilisation** :
```typescript
const connections = connectionManager.getConnections();
// Utilisé par DatabaseConnectionProvider pour afficher l'arbre des connexions
```

### `addConnection(connection: Omit<DatabaseConnection, 'id'>): Promise<void>`
**Paramètres** :
- `connection: Omit<DatabaseConnection, 'id'>` - Données de connexion sans ID
**Valeur de retour** : `Promise<void>`
**Explication de la logique** :
1. Génère automatiquement un ID unique
2. Ajoute `isConnected: true` par défaut
3. Ajoute à la liste en mémoire
4. Sauvegarde dans le stockage persistant
**Exemple d'utilisation** :
```typescript
await connectionManager.addConnection({
    name: "Production DB",
    host: "prod.example.com",
    port: 3306,
    username: "user",
    password: "password",
    type: "mysql"
});
```

### `updateConnection(id: string, connection: Partial<DatabaseConnection>): Promise<void>`
**Paramètres** :
- `id: string` - ID de la connexion à modifier
- `connection: Partial<DatabaseConnection>` - Propriétés à mettre à jour
**Valeur de retour** : `Promise<void>`
**Explication de la logique** :
1. Recherche la connexion par ID
2. Met à jour via spread operator pour fusion des propriétés
3. Sauvegarde les modifications
**Exemple d'utilisation** :
```typescript
await connectionManager.updateConnection("conn_123", { 
    isConnected: false,
    lastConnected: new Date()
});
```

### `deleteConnection(id: string): Promise<void>`
**Paramètres** :
- `id: string` - ID de la connexion à supprimer
**Valeur de retour** : `Promise<void>`
**Explication de la logique** : Utilise filter() pour retirer la connexion et persiste les changements
**Exemple d'utilisation** :
```typescript
await connectionManager.deleteConnection("conn_123");
```

### `getConnectionById(id: string): DatabaseConnection | undefined`
**Paramètres** :
- `id: string` - ID de la connexion recherchée
**Valeur de retour** : `DatabaseConnection | undefined`
**Explication de la logique** : Utilise find() pour localiser la connexion par ID
**Exemple d'utilisation** :
```typescript
const connection = connectionManager.getConnectionById("conn_123");
if (connection) {
    // Utiliser la connexion
}
```

### `exportConnections(): Promise<void>`
**Paramètres** : Aucun
**Valeur de retour** : `Promise<void>`
**Explication de la logique** :
1. Demande un mot de passe de chiffrement optionnel
2. Chiffre les mots de passe si demandé (AES-256-CBC)
3. Nettoie les propriétés runtime (isConnected, lastConnected)
4. Sauvegarde en JSON avec métadonnées (date, version, statut chiffrement)
5. Propose un dialogue de sauvegarde à l'utilisateur
**Exemple d'utilisation** :
Appelée via commande VS Code `phpDaoGenerator.exportConnections`

### `importConnections(): Promise<void>`
**Paramètres** : Aucun  
**Valeur de retour** : `Promise<void>`
**Explication de la logique** :
1. Ouvre un dialogue de sélection de fichier JSON
2. Valide la structure du fichier importé
3. Déchiffre les mots de passe si nécessaire
4. Propose le mode fusion ou remplacement
5. Génère de nouveaux IDs pour éviter les conflits
6. Persiste les nouvelles connexions
**Exemple d'utilisation** :
Appelée via commande VS Code `phpDaoGenerator.importConnections`

---

## Méthodes privées

### `loadConnections(): Promise<void>`
**Explication de la logique** : Charge les connexions depuis le stockage global VS Code au démarrage
**Usage** : Appelée automatiquement dans le constructeur

### `saveConnections(): Promise<void>`
**Explication de la logique** : Persiste l'état actuel des connexions dans le stockage global
**Usage** : Appelée après chaque modification (add, update, delete)

### `generateId(): string`
**Explication de la logique** : Génère un ID unique avec timestamp et caractères aléatoires
**Format** : `conn_{timestamp}_{9_chars_random}`
**Usage** : ID unique pour nouvelles connexions

### `encryptPassword(password: string, masterKey: string)`
**Paramètres** :
- `password: string` - Mot de passe à chiffrer
- `masterKey: string` - Clé de chiffrement
**Valeur de retour** : `{encrypted: string, iv: string}`
**Explication de la logique** :
1. Utilise l'algorithme AES-256-CBC
2. Génère un vecteur d'initialisation (IV) aléatoire
3. Dérive la clé avec scrypt et salt fixe
**Usage** : Chiffrement lors de l'export

### `decryptPassword(encryptedData: string, iv: string, masterKey: string): string`
**Paramètres** :
- `encryptedData: string` - Données chiffrées
- `iv: string` - Vecteur d'initialisation hexadécimal  
- `masterKey: string` - Clé de déchiffrement
**Explication de la logique** : Processus inverse du chiffrement avec le même algorithme
**Usage** : Déchiffrement lors de l'import

---

## Liaisons avec d'autres fichiers

### Qui appelle ce fichier ?
- **`extension.ts`** : Instancie ConnectionManager au démarrage de l'extension
- **`DatabaseConnectionProvider.ts`** : Utilise getConnections() pour construire l'arbre de navigation
- **`ConnectionFormPanel.ts`** : Appelle addConnection() et updateConnection() pour sauvegarder les formulaires

### Quels fichiers il importe ou utilise
- **`vscode`** : API VS Code pour stockage, dialogues et notifications  
- **`fs`** : Système de fichiers pour vérifications lors de l'export/import
- **`path`** : Manipulation des chemins de fichiers
- **`crypto`** : Module Node.js pour chiffrement AES
- **`../types/Connection`** : Interface DatabaseConnection

---

## Logique/Algorithme clé

### Persistance des données
1. **Chargement initial** : `constructor` → `loadConnections()` → `globalState.get()`
2. **Sauvegarde automatique** : Toute modification → `saveConnections()` → `globalState.update()`
3. **Avantages** : Données persistantes entre sessions VS Code, synchronisation workspace

### Système de chiffrement
1. **Génération clé** : `scryptSync(masterKey, 'salt', 32)` - Dérivation sécurisée
2. **Chiffrement** : AES-256-CBC avec IV aléatoire pour chaque mot de passe
3. **Format export** : JSON avec métadonnées (encrypted: boolean, passwordIv per connection)
4. **Sécurité** : IV différent pour chaque mot de passe, clé dérivée avec salt

### Gestion des erreurs
- **Validation import** : Vérification structure JSON, types de données, formats de connexion
- **Chiffrement** : Try/catch sur opérations crypto avec messages d'erreur explicites
- **UI feedback** : Messages utilisateur détaillés (succès, warnings, erreurs)

---

## Exemples d'utilisation

### Scénario complet : Ajout et export d'une connexion
```typescript
// 1. Initialisation (extension.ts)
const connectionManager = new ConnectionManager(context);

// 2. Ajout d'une nouvelle connexion (ConnectionFormPanel.ts)
await connectionManager.addConnection({
    name: "Dev Database",
    host: "localhost", 
    port: 3306,
    username: "dev_user",
    password: "dev_password",
    database: "my_app_dev",
    type: "mysql"
});

// 3. Export sécurisé (commande utilisateur)
await connectionManager.exportConnections();
// → Demande mot de passe chiffrement
// → Sauvegarde vers php-dao-connections.json
// → Mots de passe chiffrés avec AES-256-CBC

// 4. Import sur autre machine (commande utilisateur)  
await connectionManager.importConnections();
// → Sélection fichier JSON
// → Déchiffrement avec mot de passe
// → Fusion ou remplacement des connexions existantes
```

### Intégration avec l'arbre de navigation
```typescript
// DatabaseConnectionProvider.ts
export class DatabaseConnectionProvider implements vscode.TreeDataProvider<DatabaseConnectionTreeItem> {
    constructor(private connectionManager: ConnectionManager) {}
    
    getChildren(): DatabaseConnectionTreeItem[] {
        const connections = this.connectionManager.getConnections();
        return connections.map(conn => new DatabaseConnectionTreeItem(conn));
    }
}
```