# Documentation - TableSelectionPanel.ts

## Vue d'ensemble

Le fichier `TableSelectionPanel.ts` implémente l'interface utilisateur de sélection des tables pour la génération de DAO PHP. Il crée un panel webview intégré à VS Code permettant aux utilisateurs de visualiser les tables d'une base de données, sélectionner celles à traiter, choisir le mode de génération, et déclencher la création automatique des fichiers DAO.

Ce panel constitue l'étape finale du workflow de génération après la connexion à la base et la sélection d'une base de données dans l'arbre de navigation.

---

## Classe principale

### `TableSelectionPanel`

**Description générale** : Panel webview pour sélection interactive des tables et génération des fichiers DAO avec options de sauvegarde.

**Paramètres du constructeur (private)** :
- `panel: vscode.WebviewPanel` - Panel webview VS Code
- `connection: DatabaseConnection` - Configuration de connexion active  
- `database: string` - Nom de la base de données cible
- `databaseService: DatabaseService` - Service d'accès aux données
- `extensionUri: vscode.Uri` - URI de l'extension pour ressources

**Variables principales** :
- `currentPanel: TableSelectionPanel | undefined` (static) - Instance singleton du panel actif
- `_panel: vscode.WebviewPanel` - Panel webview principal
- `_disposables: vscode.Disposable[]` - Gestionnaire de nettoyage des ressources  
- `daoGenerator: DaoGeneratorService` - Instance du générateur DAO
- `connection: DatabaseConnection` - Connexion de base de données active
- `database: string` - Base de données sélectionnée

---

## Méthodes publiques statiques

### `createOrShow(connection, database, databaseService, extensionUri): Promise<void>`
**Paramètres** :
- `connection: DatabaseConnection` - Configuration de connexion
- `database: string` - Nom de la base de données  
- `databaseService: DatabaseService` - Service de données
- `extensionUri: vscode.Uri` - URI racine de l'extension

**Valeur de retour** : `Promise<void>`

**Explication de la logique** :
1. **Gestion singleton** : Vérifie si un panel existe déjà pour cette base/connexion
2. **Réutilisation intelligente** : Si panel existant pour même base → `reveal()`, sinon dispose
3. **Création panel** :
   - Type : `'tableSelection'`
   - Titre : `"Tables - {database}"`
   - Options : scripts activés, contexte persistant, ressources locales autorisées
4. **Configuration visuelle** : Icône du logo, colonne d'affichage
5. **Instanciation** : Création de l'instance et assignation au singleton

**Exemple d'utilisation** :
```typescript
// Appelée depuis DatabaseConnectionProvider lors du clic sur base de données
await TableSelectionPanel.createOrShow(
    connectionConfig,
    "my_database", 
    databaseService,
    context.extensionUri
);
```

### `dispose(): void`
**Explication de la logique** :
1. Reset du singleton statique
2. Dispose du panel webview  
3. Nettoyage des disposables via boucle while
4. Libération de toutes les ressources

---

## Méthodes privées

### `_update(): Promise<void>`
**Explication de la logique** :
1. **Configuration listener** : Écoute des messages webview via `onDidReceiveMessage`
2. **Handlers de messages** :
   - `'ready'` → `sendInitialData()` - Initialisation après chargement webview
   - `'generate'` → `handleGenerate()` - Déclenchement génération DAO
3. **Génération HTML** : Appel `_getHtmlForWebview()` pour contenu initial

### `sendInitialData(): Promise<void>`
**Explication de la logique** :
1. **État de chargement** : Message `'showLoading'` pour feedback utilisateur
2. **Données contextuelles** : Envoi database/host via `'updateData'`
3. **Chargement tables** : 
   - Appel `databaseService.getTables()` 
   - Envoi résultat via message `'updateTables'`
4. **Gestion erreurs** : Message `'showError'` si échec avec détail

**Communication webview** :
```typescript
// Exemples de messages envoyés
postMessage({ command: 'showLoading' });
postMessage({ command: 'updateData', data: { database, host } });
postMessage({ command: 'updateTables', tables: ['users', 'products'] });
```

### `handleGenerate(selectedTables, mode): Promise<void>`
**Paramètres** :
- `selectedTables: string[]` - Tables sélectionnées par l'utilisateur
- `mode: 'save' | 'overwrite'` - Mode de gestion des fichiers existants

**Explication de la logique** :
1. **Notification démarrage** : Message informatif avec nombre de tables
2. **Délégation génération** : Appel `daoGenerator.generateDaoFiles()` avec paramètres
3. **Gestion erreurs** : Affichage message d'erreur détaillé si échec

### `_getHtmlForWebview(webview): Promise<string>`
**Paramètres** :
- `webview: vscode.Webview` - Instance webview pour conversion URI

**Explication de la logique** :
1. **Résolution chemins** :
   - HTML template : `src/webview/table-selection/index.html`
   - CSS : `src/webview/table-selection/styles.css`  
   - JavaScript : `src/webview/table-selection/script.js`
2. **Conversion URI** : Transformation en URI webview sécurisées via `asWebviewUri()`
3. **Template substitution** :
   - `{{cspSource}}` → Content Security Policy source
   - `{{cssUri}}` → URI CSS sécurisé
   - `{{jsUri}}` → URI JavaScript sécurisé
4. **Fallback erreur** : Appel `_getErrorHtml()` si échec

### `_getErrorHtml(errorMessage): string`
**Explication de la logique** : Génère HTML d'erreur avec styles VS Code intégrés et message détaillé

---

## Liaisons avec d'autres fichiers

### Qui appelle ce fichier ?
- **`DatabaseConnectionProvider.ts`** : Via `openTableSelection()` lors du clic sur nœud database
- **`extension.ts`** : Enregistrement de la commande `phpDaoGenerator.openTableSelection`

### Quels fichiers il importe ou utilise
- **`vscode`** : API webview, panels, messages, colonnes
- **`path`** / **`fs`** : Accès fichiers template HTML/CSS/JS
- **`../types/Connection`** : Interface DatabaseConnection
- **`../services/DatabaseService`** : Récupération liste des tables  
- **`../services/DaoGeneratorService`** : Génération des fichiers DAO
- **Ressources webview** : `src/webview/table-selection/` (HTML/CSS/JS)

---

## Logique/Algorithme clé

### Pattern Singleton avec réutilisation intelligente
```typescript
// Logique de réutilisation
if (currentPanel && 
    currentPanel.database === database &&
    currentPanel.connection.id === connection.id) {
    currentPanel._panel.reveal(column);  // Réutilise
    return;
}
// Sinon dispose et recrée
```

### Communication bidirectionnelle webview
```
VS Code Extension          ←→          Webview Frontend
─────────────────                     ─────────────────
sendInitialData()         →           ready event
updateData message        →           display database/host  
updateTables message      →           populate table list
                         ←           generate command
handleGenerate()         ←           {selectedTables, mode}
```

### Cycle de vie du panel
1. **Création** : `createOrShow()` → nouveau webview panel
2. **Initialisation** : `_update()` → HTML + listeners
3. **Communication** : Messages bidirectionnels avec webview
4. **Action** : Génération DAO via service dédié
5. **Nettoyage** : `dispose()` → libération ressources

---

## Architecture webview intégrée

### Structure des templates
```
src/webview/table-selection/
├── index.html     (Structure HTML + placeholders)
├── styles.css     (Styles VS Code theme-aware)
└── script.js      (Logique frontend + communication)
```

### Sécurité Content Security Policy
- Ressources locales uniquement via `asWebviewUri()`
- CSP source dynamique : `{{cspSource}}`
- Scripts inline sécurisés pour communication VS Code

### Messages webview standardisés
```typescript
// Frontend → Extension
{ command: 'ready' }
{ command: 'generate', selectedTables: string[], mode: string }

// Extension → Frontend  
{ command: 'showLoading' }
{ command: 'updateData', data: {database, host} }
{ command: 'updateTables', tables: string[] }
{ command: 'showError', error: string }
```

---

## Exemples d'utilisation

### Workflow complet utilisateur
```typescript
// 1. Utilisateur clique sur base dans l'arbre (DatabaseConnectionProvider)
await TableSelectionPanel.createOrShow(
    connectionConfig,
    "ecommerce_db", 
    databaseService,
    extensionUri
);

// 2. Panel s'ouvre → webview charge → message 'ready'
// 3. sendInitialData() → récupère tables → affiche interface

// 4. Utilisateur sélectionne tables + mode → clic "Générer"
// 5. Message 'generate' → handleGenerate() → DaoGeneratorService

// 6. Génération terminée → messages de succès → panel peut rester ouvert
```

### Intégration avec DatabaseConnectionProvider
```typescript
// DatabaseConnectionProvider.ts
async openTableSelection(item: DatabaseTreeItem): Promise<void> {
    if (item.contextValue === 'database') {
        await TableSelectionPanel.createOrShow(
            item.connection,
            item.database!,
            this.databaseService,
            this.extensionUri
        );
    }
}
```

### Communication webview exemple
```javascript
// script.js (frontend)
document.getElementById('generateBtn').addEventListener('click', () => {
    const selectedTables = getSelectedTables();
    const mode = getSelectedMode(); 
    
    vscode.postMessage({
        command: 'generate',
        selectedTables: selectedTables,
        mode: mode
    });
});

// Réception réponse
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'updateTables':
            populateTableList(message.tables);
            break;
    }
});
```

### Pattern de gestion d'état
```typescript
// Singleton pattern avec état persistant
class TableSelectionPanel {
    private static currentPanel: TableSelectionPanel | undefined;
    
    // Réutilisation intelligente
    public static async createOrShow(...) {
        if (currentPanel?.matches(connection, database)) {
            return currentPanel.reveal();
        }
        // Nouveau panel nécessaire
        return new TableSelectionPanel(...);
    }
}
```