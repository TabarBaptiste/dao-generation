# Documentation - ConnectionFormPanel.ts

## Vue d'ensemble

Le fichier `ConnectionFormPanel.ts` implémente l'interface de saisie et d'édition des connexions de base de données via un panel webview VS Code. Il gère la création/modification de configurations de connexion avec validation en temps réel, test de connectivité, et chargement dynamique des bases de données disponibles.

Ce panel constitue le point d'entrée principal pour configurer les connexions MySQL/MariaDB dans l'extension, avec une interface utilisateur riche et des fonctionnalités de validation avancées.

---

## Classe principale

### `ConnectionFormPanel`

**Description générale** : Panel webview pour saisie et édition des configurations de connexion de base de données avec validation interactive.

**Paramètres du constructeur** : Aucun (constructeur par défaut)

**Variables principales** :
- `databaseService: DatabaseService` - Instance du service de base de données pour tests de connexion
- `panel: vscode.WebviewPanel | undefined` - Panel webview actuel (undefined quand fermé)

---

## Méthodes publiques

### `show(existingData?, extensionUri?): Promise<ConnectionFormData | undefined>`
**Paramètres** :
- `existingData?: ConnectionFormData` - Données existantes pour mode édition (optionnel)
- `extensionUri?: vscode.Uri` - URI de l'extension pour ressources (optionnel)

**Valeur de retour** : `Promise<ConnectionFormData | undefined>`
- `ConnectionFormData` si formulaire validé et soumis
- `undefined` si annulé ou fermé

**Explication de la logique** :
1. **Création panel** : Webview avec titre dynamique ("Add" vs "Edit")
2. **Configuration** :
   - Scripts activés pour interactivité
   - Contexte persistant si utilisateur change d'onglet
   - Ressources locales autorisées pour CSS/JS
3. **Icône** : Logo de l'extension si URI fourni
4. **Gestion Promise** : Retourne une Promise résolue par les messages webview
5. **Listeners** :
   - Messages webview : ready, submit, cancel, testConnection, loadDatabases
   - Dispose panel : résolution avec `undefined`

**Exemple d'utilisation** :
```typescript
// Nouvelle connexion
const connectionData = await formPanel.show(undefined, extensionUri);

// Édition connexion existante  
const updatedData = await formPanel.show(existingConnectionData, extensionUri);

if (connectionData) {
    await connectionManager.addConnection(connectionData);
}
```

---

## Méthodes privées

### Handlers de messages webview

#### `handleTestConnection(data): Promise<void>`
**Paramètres** :
- `data: any` - Données de connexion du formulaire

**Explication de la logique** :
1. **Transformation données** : Conversion vers format `DatabaseConnection`
2. **Test connexion** : Appel `databaseService.testConnection()`
3. **Retour utilisateur** : Message `'testConnectionResult'` avec statut et message explicite
4. **Gestion erreurs** : Capture exceptions et formatage message d'erreur

**Communication webview** :
```typescript
// Message envoyé au frontend
this.panel?.webview.postMessage({
    command: 'testConnectionResult',
    success: boolean,
    message: string
});
```

#### `handleLoadDatabases(data): Promise<void>`
**Paramètres** :
- `data: any` - Données de connexion pour chargement bases

**Explication de la logique** :
1. **Connexion temporaire** : Création config temporaire avec ID 'temp'
2. **Récupération bases** : `databaseService.getDatabases()` 
3. **Envoi résultat** : Message `'databasesLoaded'` avec liste des bases
4. **Gestion erreurs** : Retour liste vide + message d'erreur

### Gestion du contenu webview

#### `getWebviewContent(existingData?, extensionUri?): string`
**Paramètres** :
- `existingData?: ConnectionFormData` - Données pré-remplies  
- `extensionUri?: vscode.Uri` - URI extension pour ressources

**Explication de la logique** :
1. **Validation URI** : Retour erreur si extensionUri manquant
2. **Résolution chemins** : 
   - Template HTML : `src/webview/connection-form/index.html`
   - Styles : `src/webview/connection-form/styles.css`
   - Script : `src/webview/connection-form/script.js`
3. **Sécurisation URI** : Conversion via `asWebviewUri()` pour CSP
4. **Substitution template** : Remplacement placeholders `{{cspSource}}`, `{{cssUri}}`, `{{jsUri}}`
5. **Fallback erreur** : HTML d'erreur si échec chargement

#### `getErrorHtml(errorMessage): string`
**Paramètres** :
- `errorMessage: string` - Message d'erreur à afficher

**Explication de la logique** : 
- Génère HTML avec styles VS Code natifs
- Affichage structuré de l'erreur avec titre et détail
- Utilise variables CSS VS Code pour cohérence visuelle

---

## Liaisons avec d'autres fichiers

### Qui appelle ce fichier ?
- **`DatabaseConnectionProvider.ts`** : 
  - `addConnection()` → Nouveau formulaire
  - `editConnection()` → Édition connexion existante
- **Commandes VS Code** : Via `phpDaoGenerator.addConnection`

### Quels fichiers il importe ou utilise
- **`vscode`** : API webview, panels, colonnes d'affichage
- **`path`** / **`fs`** : Accès aux templates HTML/CSS/JS
- **`../types/Connection`** : Interface `ConnectionFormData`
- **`../services/DatabaseService`** : Tests connexion et chargement bases
- **Templates webview** : `src/webview/connection-form/` (index.html, styles.css, script.js)

---

## Logique/Algorithme clé

### Pattern Promise avec résolution par messages
```typescript
public async show(...): Promise<ConnectionFormData | undefined> {
    return new Promise((resolve) => {
        // Création panel
        this.panel = vscode.window.createWebviewPanel(...);
        
        // Listeners messages
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'submit':
                    resolve(message.data);  // Données validées
                    this.panel?.dispose();
                    break;
                case 'cancel':
                    resolve(undefined);     // Annulation
                    this.panel?.dispose();
                    break;
            }
        });
        
        // Dispose = annulation
        this.panel.onDidDispose(() => resolve(undefined));
    });
}
```

### Communication bidirectionnelle avec validation temps réel
```
Webview Frontend                    Extension Backend
────────────────                    ─────────────────
Saisie formulaire     →             
Test connexion       →             handleTestConnection()
                     ←             testConnectionResult
Load databases       →             handleLoadDatabases()  
                     ←             databasesLoaded
Soumission           →             resolve(data)
```

### Workflow de validation
1. **Saisie utilisateur** : Formulaire webview avec champs typés
2. **Test temps réel** : Bouton "Test Connection" → validation immédiate
3. **Chargement dynamique** : Bouton "Load Databases" → populate dropdown
4. **Validation finale** : Submit → retour données validées à l'appelant
5. **Gestion annulation** : Cancel ou fermeture → retour `undefined`

---

## Architecture d'intégration webview

### Templates et ressources
```
src/webview/connection-form/
├── index.html      (Structure formulaire + placeholders)  
├── styles.css      (Styles VS Code + responsive)
└── script.js       (Validation + communication)
```

### Sécurité et CSP
- **Local resources** : Chemin restricté à `src/webview`
- **URI sécurisées** : `asWebviewUri()` pour toutes les ressources
- **CSP dynamique** : `{{cspSource}}` injecté automatiquement

### Messages standardisés
```typescript
// Frontend → Extension
{ command: 'ready' }                              // Initialisation
{ command: 'submit', data: ConnectionFormData }   // Soumission
{ command: 'cancel' }                            // Annulation  
{ command: 'testConnection', data: FormData }     // Test connexion
{ command: 'loadDatabases', data: FormData }      // Chargement bases

// Extension → Frontend
{ command: 'loadData', data: ConnectionFormData, isEdit: boolean }  // Pré-remplissage
{ command: 'testConnectionResult', success: boolean, message: string }  // Résultat test
{ command: 'databasesLoaded', databases: string[], error?: string }     // Bases disponibles
```

---

## Exemples d'utilisation

### Ajout nouvelle connexion (DatabaseConnectionProvider)
```typescript
// DatabaseConnectionProvider.ts
public async addConnection(): Promise<void> {
    const formPanel = new ConnectionFormPanel();
    const connectionData = await formPanel.show(undefined, this.extensionUri);
    
    if (connectionData) {
        await this.connectionManager.addConnection({
            name: connectionData.name,
            host: connectionData.host,
            port: parseInt(connectionData.port),
            username: connectionData.username,
            password: connectionData.password,
            database: connectionData.database,
            type: connectionData.type
        });
        
        this.refresh(); // Actualise l'arbre
        vscode.window.showInformationMessage(`Connection "${connectionData.name}" added successfully`);
    }
}
```

### Édition connexion existante
```typescript
public async editConnection(item: DatabaseConnectionTreeItem): Promise<void> {
    const connection = item.connection;
    const existingData: ConnectionFormData = {
        name: connection.name,
        host: connection.host,
        port: connection.port.toString(),
        username: connection.username,
        password: connection.password,
        database: connection.database || '',
        type: connection.type
    };
    
    const formPanel = new ConnectionFormPanel();
    const updatedData = await formPanel.show(existingData, this.extensionUri);
    
    if (updatedData) {
        await this.connectionManager.updateConnection(connection.id, {
            name: updatedData.name,
            host: updatedData.host,
            port: parseInt(updatedData.port),
            username: updatedData.username,
            password: updatedData.password,
            database: updatedData.database,
            type: updatedData.type
        });
        
        this.refresh();
    }
}
```

### Validation temps réel (script.js)
```javascript
// Frontend - Test de connexion
document.getElementById('testBtn').addEventListener('click', () => {
    const formData = collectFormData();
    
    // UI feedback
    showTestingState();
    
    // Envoi vers extension
    vscode.postMessage({
        command: 'testConnection',
        data: formData
    });
});

// Réception résultat
window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'testConnectionResult') {
        showTestResult(message.success, message.message);
    }
});
```

### Chargement dynamique des bases
```javascript
// Frontend - Load databases
document.getElementById('loadDbBtn').addEventListener('click', () => {
    const connectionData = collectConnectionData();
    
    vscode.postMessage({
        command: 'loadDatabases',
        data: connectionData
    });
});

// Populate dropdown avec résultat
window.addEventListener('message', event => {
    if (event.data.command === 'databasesLoaded') {
        const select = document.getElementById('database');
        select.innerHTML = '<option value="">Select database...</option>';
        
        event.data.databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db;
            option.textContent = db;
            select.appendChild(option);
        });
    }
});
```