# Documentation - Fichier Principal

## extension.ts

### Vue d'ensemble
Le fichier `extension.ts` est le point d'entrée principal de l'extension VS Code "PHP DAO Generator". Il gère l'activation, l'initialisation des services et l'enregistrement des commandes.

### Structure du fichier

#### Imports
```typescript
import * as vscode from 'vscode';
import { DatabaseConnectionProvider } from './providers/DatabaseConnectionProvider';
import { ConnectionManager } from './services/ConnectionManager';
import { DatabaseService } from './services/DatabaseService';
```

- **vscode** : API officielle de VS Code pour les extensions
- **DatabaseConnectionProvider** : Fournisseur de données pour l'arbre des connexions de base de données
- **ConnectionManager** : Gestionnaire des connexions (stockage/récupération)
- **DatabaseService** : Service pour les opérations de base de données (connexion, requêtes)

---

## Fonctions Principales

### `activate(context: vscode.ExtensionContext)`

**Rôle** : Fonction principale appelée lors de l'activation de l'extension.

**Paramètres** :
- `context` : Contexte d'extension VS Code contenant l'URI de l'extension et les souscriptions

**Actions réalisées** :

1. **Logging et notification**
   ```typescript
   console.log('PHP DAO Generator extension activated successfully!');
   ```
   - Affiche un message de confirmation d'activation dans la console de développement

2. **Initialisation des services**
   ```typescript
   const databaseService = new DatabaseService();
   const connectionManager = new ConnectionManager(context);
   const connectionProvider = new DatabaseConnectionProvider(connectionManager, databaseService, context.extensionUri);
   ```
   - **DatabaseService** : Instance pour les opérations MySQL/MariaDB
   - **ConnectionManager** : Instance pour la gestion persistante des connexions
   - **DatabaseConnectionProvider** : Instance pour l'interface utilisateur de l'arbre

3. **Enregistrement de la vue d'arbre**
   ```typescript
   vscode.window.createTreeView('phpDaoConnections', {
       treeDataProvider: connectionProvider,
       showCollapseAll: true
   });
   ```
   - Crée la vue d'arbre dans la sidebar avec ID `phpDaoConnections`
   - Active le bouton "Collapse All" pour replier toutes les branches

4. **Enregistrement des commandes**

   **Commandes de gestion des connexions :**
   - `phpDaoGenerator.addConnection` → `connectionProvider.addConnection()`
   - `phpDaoGenerator.refreshConnections` → `connectionProvider.refresh()`
   - `phpDaoGenerator.editConnection` → `connectionProvider.editConnection(item)`
   - `phpDaoGenerator.deleteConnection` → `connectionProvider.deleteConnection(item)`

   **Commandes de connexion/déconnexion :**
   - `phpDaoGenerator.connect` → `connectionProvider.connectToDatabase(item)`
   - `phpDaoGenerator.disconnect` → `connectionProvider.disconnectFromDatabase(item)`

   **Commandes de génération :**
   - `phpDaoGenerator.openTableSelection` → `connectionProvider.openTableSelection(item)`

5. **Gestion du cycle de vie**
   ```typescript
   context.subscriptions.push(
       addConnectionCommand,
       refreshConnectionsCommand,
       // ... autres commandes
   );
   ```
   - Ajoute toutes les commandes aux souscriptions pour un nettoyage automatique

6. **Nettoyage des ressources**
   ```typescript
   context.subscriptions.push({
       dispose: () => databaseService.disconnectAll()
   });
   ```
   - Garantit la fermeture de toutes les connexions de base de données lors de la désactivation

---

### `deactivate()`

**Rôle** : Fonction appelée lors de la désactivation de l'extension.

**Actions** :
- Log de confirmation de désactivation
- Nettoyage automatique via les souscriptions (pas d'action explicite nécessaire)

---

## Flux d'activation

1. **Déclenchement** : VS Code active l'extension selon les `activationEvents` du `package.json`
2. **Initialisation** : Création des instances de services
3. **Configuration UI** : Création de la vue d'arbre dans la sidebar
4. **Enregistrement** : Liaison des commandes aux méthodes correspondantes
5. **État prêt** : L'extension est opérationnelle et répond aux interactions utilisateur

---

## Intégration avec VS Code

- **Activity Bar** : Icône "PHP DAO Generator" (définie dans `package.json`)
- **Tree View** : Vue des connexions dans le panneau latéral
- **Command Palette** : Toutes les commandes sont disponibles via `Ctrl+Shift+P`
- **Context Menu** : Actions contextuelles sur les éléments de l'arbre

---

## Gestion d'erreur et robustesse

- Utilisation du système de souscriptions VS Code pour le nettoyage automatique
- Fermeture proactive des connexions de base de données
- Logging pour le débogage et le monitoring
