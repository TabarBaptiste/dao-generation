# Documentation - DatabaseConnectionProvider.ts

## Vue d'ensemble

Le fichier `DatabaseConnectionProvider.ts` implémente le fournisseur de données pour l'arbre hiérarchique de navigation des connexions de base de données dans la sidebar VS Code. Il gère l'affichage dynamique des connexions, bases de données et tables sous forme d'arbre expandable avec actions contextuelles, intégrant les patterns VS Code TreeDataProvider et Command.

Ce provider constitue l'interface principale de navigation et de gestion des connexions, orchestrant l'interaction entre les services de données, les panels de configuration et la génération de DAO.

---

## Classes principales

### `DatabaseConnectionTreeItem`

**Description générale** : Élément individuel de l'arbre représentant une connexion, base de données ou table avec métadonnées et actions associées.

**Paramètres du constructeur** :
- `connection: DatabaseConnection` - Configuration de connexion associée
- `collapsibleState: vscode.TreeItemCollapsibleState` - État d'expansion (None, Collapsed, Expanded)
- `itemType: 'connection' | 'database' | 'table'` - Type d'élément pour comportement spécifique
- `databaseName?: string` - Nom de base pour éléments database/table
- `tableName?: string` - Nom de table pour éléments table

**Variables principales** :
- Hérite de `vscode.TreeItem` avec propriétés : label, tooltip, description, contextValue, iconPath, command

**Logique de configuration par type** :
```typescript
// Connection
contextValue = connection.isConnected ? 'connectedConnection' : 'disconnectedConnection'
iconPath = ThemeIcon(isConnected ? 'database' : 'circle-outline')

// Database  
contextValue = 'database'
iconPath = ThemeIcon('folder-library')
command = 'phpDaoGenerator.openTableSelection'

// Table
contextValue = 'table'  
iconPath = ThemeIcon('table')
command = 'phpDaoGenerator.openTableSelection'
```

### `DatabaseConnectionProvider`

**Description générale** : Provider principal implémentant `TreeDataProvider<DatabaseConnectionTreeItem>` pour la gestion complète de l'arbre de navigation.

**Paramètres du constructeur** :
- `connectionManager: ConnectionManager` - Gestionnaire des connexions persistées
- `databaseService: DatabaseService` - Service d'accès aux données MySQL/MariaDB  
- `extensionUri: vscode.Uri` - URI extension pour ressources et panels

**Variables principales** :
- `_onDidChangeTreeData: EventEmitter` - Émetteur d'événements pour rafraîchissement
- `onDidChangeTreeData: Event` - Event publique pour souscription VS Code

---

## Méthodes TreeDataProvider (interface VS Code)

### `getTreeItem(element): vscode.TreeItem`
**Paramètres** :
- `element: DatabaseConnectionTreeItem` - Élément à convertir

**Explication de la logique** : Retourne directement l'élément car `DatabaseConnectionTreeItem` hérite déjà de `TreeItem`

### `getChildren(element?): Thenable<DatabaseConnectionTreeItem[]>`
**Paramètres** :
- `element?: DatabaseConnectionTreeItem` - Élément parent (undefined = racine)

**Explication de la logique** :
1. **Niveau racine** (element = undefined) :
   - Récupère toutes les connexions via `connectionManager.getConnections()`
   - Crée TreeItem avec état Collapsed si connecté, None si déconnecté
2. **Connexion connectée** :
   - Appelle `getDatabasesForConnection()` pour lister les bases
3. **Base de données** :
   - Appelle `getTablesForDatabase()` pour lister les tables
4. **Autres cas** : Retourne tableau vide

### `refresh(): void`
**Explication de la logique** : Déclenche `_onDidChangeTreeData.fire()` pour forcer la mise à jour de l'arbre VS Code

---

## Méthodes privées de récupération de données

### `getDatabasesForConnection(connection): Promise<DatabaseConnectionTreeItem[]>`
**Paramètres** :
- `connection: DatabaseConnection` - Connexion pour laquelle récupérer les bases

**Explication de la logique** :
1. Appel `databaseService.getDatabases(connection)`
2. Transformation en TreeItems avec type 'database' et état Collapsed
3. Gestion d'erreurs : log et retour tableau vide

### `getTablesForDatabase(connection, database): Promise<DatabaseConnectionTreeItem[]>`
**Paramètres** :
- `connection: DatabaseConnection` - Connexion active
- `database: string` - Nom de la base de données

**Explication de la logique** :
1. Appel `databaseService.getTables(connection, database)`
2. Transformation en TreeItems avec type 'table' et état None (feuilles)
3. Gestion d'erreurs : log et retour tableau vide

---

## Méthodes publiques de gestion des connexions

### `addConnection(): Promise<void>`
**Explication de la logique** :
1. **Ouverture formulaire** : Instanciation `ConnectionFormPanel` et appel `show()`
2. **Validation données** : Vérification retour formulaire (non undefined)
3. **Sauvegarde** : Appel `connectionManager.addConnection()` avec transformation
4. **Rafraîchissement** : `refresh()` + message de succès

**Exemple d'utilisation** : Commande `phpDaoGenerator.addConnection`

### `editConnection(item): Promise<void>`
**Paramètres** :
- `item: DatabaseConnectionTreeItem` - Connexion à éditer

**Explication de la logique** :
1. **Pré-remplissage** : Création `ConnectionFormData` depuis connexion existante
2. **Édition** : `ConnectionFormPanel.show()` avec données existantes
3. **Mise à jour** : `connectionManager.updateConnection()` si validé
4. **Interface** : Refresh + notification succès

### `deleteConnection(item): Promise<void>`
**Paramètres** :
- `item: DatabaseConnectionTreeItem` - Connexion à supprimer

**Explication de la logique** :
1. **Confirmation** : `showWarningMessage()` modal avec bouton "Delete"
2. **Suppression** : `connectionManager.deleteConnection()` si confirmé
3. **Nettoyage** : Refresh + message de succès

---

## Méthodes de connexion/déconnexion

### `connectToDatabase(item): Promise<void>`
**Paramètres** :
- `item: DatabaseConnectionTreeItem` - Connexion à activer

**Explication de la logique** :
1. **Connexion physique** : `databaseService.connect(connection)`
2. **Mise à jour état** : `connectionManager.updateConnection()` avec `isConnected: true` et `lastConnected: new Date()`
3. **Interface** : Refresh pour changer icône + message succès
4. **Gestion erreurs** : Message d'erreur avec détails

### `disconnectFromDatabase(item): Promise<void>`
**Paramètres** :
- `item: DatabaseConnectionTreeItem` - Connexion à fermer

**Explication de la logique** :
1. **Déconnexion** : `databaseService.disconnect(connectionId)`
2. **Mise à jour état** : `isConnected: false` dans le manager
3. **Interface** : Refresh + notification

---

## Méthodes d'orchestration

### `openTableSelection(item): Promise<void>`
**Paramètres** :
- `item: DatabaseConnectionTreeItem` - Élément database ou table cliqué

**Explication de la logique** :
1. **Détermination base** : Extraction `databaseName` selon le type d'item
2. **Validation** : Vérification présence nom de base
3. **Ouverture panel** : `TableSelectionPanel.createOrShow()` avec paramètres
4. **Gestion erreurs** : Message si impossible de déterminer la base

**Utilisation** : Commande liée aux items database/table dans l'arbre

### `exportConnections(): Promise<void>`
**Explication de la logique** : Délégation directe vers `connectionManager.exportConnections()`

### `importConnections(): Promise<void>`
**Explication de la logique** :
1. Délégation vers `connectionManager.importConnections()`
2. **Rafraîchissement** : `refresh()` pour afficher connexions importées

---

## Liaisons avec d'autres fichiers

### Qui appelle ce fichier ?
- **`extension.ts`** : Instanciation du provider et enregistrement comme TreeDataProvider
- **Commandes VS Code** : Toutes les commandes `phpDaoGenerator.*` via le menu contextuel et toolbar

### Quels fichiers il importe ou utilise
- **`vscode`** : API TreeDataProvider, TreeItem, ThemeIcon, commandes
- **`../types/Connection`** : Interfaces DatabaseConnection, ConnectionFormData
- **`../services/ConnectionManager`** : CRUD des connexions persistées
- **`../panels/ConnectionFormPanel`** : Formulaires d'ajout/édition
- **`../panels/TableSelectionPanel`** : Interface de génération DAO
- **`../services/DatabaseService`** : Accès données MySQL/MariaDB

---

## Logique/Algorithme clé

### Architecture hiérarchique de l'arbre
```
Connexions (racine)
├── Connection 1 [disconnectedConnection] 🔴
├── Connection 2 [connectedConnection] 🟢  
│   ├── Database A [database] 📁
│   │   ├── Table users [table] 📋
│   │   ├── Table products [table] 📋  
│   │   └── Table orders [table] 📋
│   └── Database B [database] 📁
│       └── Table categories [table] 📋
└── Connection 3 [disconnectedConnection] 🔴
```

### Pattern Event-Driven pour rafraîchissement
```typescript
// Modification des données
await connectionManager.addConnection(data);

// Notification changement
this.refresh(); // → _onDidChangeTreeData.fire()

// VS Code rafraîchit automatiquement l'arbre
// → appelle getChildren() avec nouveaux éléments
```

### États et contextes conditionnels
```typescript
// Contextual values pour menu contextuel
'disconnectedConnection' → [Edit, Delete, Connect]  
'connectedConnection'    → [Disconnect]
'database'              → [Generate DAO] (via command)
'table'                 → [Generate DAO] (via command)
```

### Pattern Command pour actions sur éléments
```typescript
// Configuration automatique des commandes
database/table TreeItems → command: 'phpDaoGenerator.openTableSelection'

// Extension registration (extension.ts)
vscode.commands.registerCommand('phpDaoGenerator.openTableSelection', 
    (item) => provider.openTableSelection(item)
);
```

---

## Exemples d'utilisation

### Workflow complet utilisateur
```typescript
// 1. Ajout connexion via toolbar "+" 
await provider.addConnection();
// → ConnectionFormPanel → ConnectionManager → refresh()

// 2. Connexion via menu contextuel
await provider.connectToDatabase(connectionItem);
// → DatabaseService.connect() → état isConnected → expand arbre

// 3. Navigation: Connection → Database → Generate DAO
await provider.openTableSelection(databaseItem);
// → TableSelectionPanel.createOrShow()

// 4. Génération DAO
// TableSelectionPanel → DaoGeneratorService.generateDaoFiles()
```

### Intégration avec extension.ts
```typescript
// extension.ts - Setup du provider
const provider = new DatabaseConnectionProvider(
    connectionManager,
    databaseService, 
    context.extensionUri
);

// Enregistrement TreeView
vscode.window.createTreeView('phpDaoConnections', {
    treeDataProvider: provider,
    showCollapseAll: true
});

// Enregistrement des commandes
vscode.commands.registerCommand('phpDaoGenerator.addConnection', 
    () => provider.addConnection()
);
vscode.commands.registerCommand('phpDaoGenerator.editConnection',
    (item) => provider.editConnection(item)
);
// ... autres commandes
```

### Pattern de récupération de données avec cache naturel
```typescript
// VS Code appelle getChildren() selon l'expansion utilisateur
getChildren(connectionItem) → getDatabasesForConnection()
                           → DatabaseService.getDatabases() 
                           → Affichage bases disponibles

// Re-expansion = nouvelle requête (pas de cache explicite)
// Cache naturel par l'état de l'arbre VS Code
```

### Gestion des erreurs et états
```typescript
// Connexion échouée
try {
    await databaseService.connect(connection);
    // État connecté + expand possible
} catch (error) {
    // Reste déconnecté + message d'erreur
    vscode.window.showErrorMessage(`Failed to connect: ${error.message}`);
}

// Base de données inaccessible  
async getDatabasesForConnection() {
    try {
        return await databaseService.getDatabases();
    } catch {
        return []; // Connexion reste expandable mais vide
    }
}
```

### Synchronisation état visuel/données
```typescript
// Changement d'état → actualisation visuelle immédiate
await connectionManager.updateConnection(id, { isConnected: true });
this.refresh(); // → VS Code redessine avec nouvelles icônes/états

// Pattern utilisé partout:
// 1. Modification données
// 2. refresh() 
// 3. Message utilisateur
```