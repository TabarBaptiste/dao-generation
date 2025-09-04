# Documentation - DatabaseService.ts

## Vue d'ensemble

Le fichier `DatabaseService.ts` constitue le service central de gestion des connexions et d'interaction avec les bases de données MySQL/MariaDB dans l'extension PHP DAO Generator. Il fournit une couche d'abstraction pour toutes les opérations de base de données et gère les connexions de manière optimisée.

---

## Architecture et Responsabilités

### Rôle Principal
- **Service de données** : Interface unique pour toutes les interactions avec les bases de données
- **Gestionnaire de connexions** : Pool de connexions MySQL avec gestion automatique du cycle de vie
- **Extracteur de métadonnées** : Récupération des informations de schéma (bases, tables, colonnes)
- **Validateur de connexions** : Tests et validation des paramètres de connexion

### Position dans l'architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                     Extension VS Code                           │
├─────────────────────┬───────────────────┬───────────────────────┤
│ ConnectionFormPanel │ TableSelectionPanel │ DatabaseConnectionProvider │
├─────────────────────┴───────────────────┴───────────────────────┤
│                  DatabaseService (SERVICE LAYER)                │
├─────────────────────────────────────────────────────────────────┤
│                     mysql2/promise                              │
├─────────────────────────────────────────────────────────────────┤
│                   Base de données MySQL/MariaDB                 │
└─────────────────────────────────────────────────────────────────┘

```

---

## Classe DatabaseService

### Propriétés privées

```typescript
private connections: Map<string, mysql.Connection> = new Map();
```

**Description** : Pool de connexions actives indexées par l'ID de connexion.

**Utilisation** :
- **Gestion de pool** : Évite la création répétée de connexions
- **Performance** : Réutilisation des connexions établies
- **Nettoyage** : Suivi des connexions pour fermeture propre

---

## Méthodes Publiques

### `testConnection(connection: DatabaseConnection): Promise<boolean>`

**Rôle** : Valide les paramètres de connexion en effectuant un test de connectivité.

**Paramètres** :
- `connection: DatabaseConnection` : Configuration de connexion à tester

**Retour** :
- `Promise<boolean>` : `true` si la connexion réussit, `false` sinon

**Logique interne** :
1. Création d'une connexion temporaire via [`createConnection()`](./../../src/services/DatabaseService.ts#119)
2. Test de connectivité avec `conn.ping()`
3. Fermeture immédiate de la connexion
4. Gestion des erreurs avec logging

**Utilisation dans l'extension** :
- **[ConnectionFormPanel](./../../src/panels/ConnectionFormPanel.ts#81#56)** : Validation en temps réel des formulaires
- **Tests utilisateur** : Bouton "[Test Connection](./../../src/webview/connection-form/index.html#66)" dans l'interface

**Exemple d'usage** :
```typescript
const isValid = await databaseService.testConnection({
    id: 'temp',
    name: 'Test DB',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'password',
    type: 'mysql'
});
```

---

### `connect(connection: DatabaseConnection): Promise<void>`

**Rôle** : Établit une connexion persistante et l'ajoute au pool.

**Paramètres** :
- `connection: DatabaseConnection` : Configuration de la connexion

**Comportement** :
1. **Fermeture préventive** : Déconnexion de l'ancienne connexion si elle existe
2. **Création nouvelle** : Nouvelle connexion via `createConnection()`
3. **Ajout au pool** : Stockage dans la Map `connections`
4. **Logging** : Confirmation de connexion

**Utilisation** :
- **[DatabaseConnectionProvider](./../../src/providers/DatabaseConnectionProvider.ts#196)** : Connexion manuelle aux bases de données
- **États persistants** : Maintien des connexions actives entre les opérations

---

### `disconnect(connectionId: string): Promise<void>`

**Rôle** : Ferme proprement une connexion spécifique et la retire du pool.

**Paramètres** :
- `connectionId: string` : Identifiant unique de la connexion

**Logique** :
1. **Recherche** : Localisation de la connexion dans le pool
2. **Fermeture** : Appel de `conn.end()` pour fermeture propre
3. **Nettoyage** : Suppression de la Map
4. **Gestion d'erreurs** : Logging des erreurs sans propagation

**Utilisation** :
- **DatabaseConnectionProvider** : Déconnexion manuelle
- **Nettoyage automatique** : Avant création de nouvelles connexions

---

### `isConnected(connectionId: string): boolean`

**Rôle** : Vérifie si une connexion spécifique est active dans le pool.

**Paramètres** :
- `connectionId: string` : ID de la connexion à vérifier

**Retour** :
- `boolean` : État de présence dans le pool

**Utilisation** :
- **Interface utilisateur** : Affichage des états de connexion
- **Logique conditionnelle** : Décisions basées sur l'état des connexions

---

### `getDatabases(connection: DatabaseConnection): Promise<string[]>`

**Rôle** : Récupère la liste des bases de données disponibles sur un serveur.

**Paramètres** :
- `connection: DatabaseConnection` : Configuration de connexion au serveur

**Retour** :
- `Promise<string[]>` : Liste des noms de bases de données utilisateur

**Implémentation** :
1. **Connexion temporaire** : Création d'une connexion dédiée
2. **Requête système** : `SHOW DATABASES`
3. **Filtrage** : Exclusion des bases système (`information_schema`, `performance_schema`, `mysql`, `sys`)
4. **Nettoyage** : Fermeture de la connexion temporaire

**Utilisation** :
- **DatabaseConnectionProvider** : Arbre hiérarchique des connexions
- **Interface utilisateur** : Sélection de bases de données

**Note importante** : Utilise des connexions temporaires pour éviter la pollution du pool avec des connexions multiples.

---

### `getTables(connection: DatabaseConnection, database: string): Promise<string[]>`

**Rôle** : Récupère la liste des tables d'une base de données spécifique.

**Paramètres** :
- `connection: DatabaseConnection` : Configuration de connexion
- `database: string` : Nom de la base de données cible

**Retour** :
- `Promise<string[]>` : Liste des noms de tables

**Implémentation optimisée** :
1. **Connexion temporaire** : Évite l'utilisation du pool
2. **Requête qualifiée** : `SHOW TABLES FROM \`database\`` au lieu de `USE database; SHOW TABLES`
3. **Extraction dynamique** : Gestion de la clé `Tables_in_{database}`
4. **Nettoyage automatique** : Fermeture systématique

**Utilisation** :
- **TableSelectionPanel** : Liste des tables pour génération DAO
- **DatabaseConnectionProvider** : Arbre hiérarchique tables/bases
- **Interface utilisateur** : Sélection multiple de tables

**Optimisation** : La requête qualifiée évite les problèmes de contexte de base de données.

---

### `getTableInfo(connection: DatabaseConnection, database: string, tableName: string): Promise<TableInfo>`

**Rôle** : Récupère les métadonnées complètes d'une table (colonnes, types, contraintes).

**Paramètres** :
- `connection: DatabaseConnection` : Configuration de connexion
- `database: string` : Nom de la base de données
- `tableName: string` : Nom de la table à analyser

**Retour** :
- `Promise<TableInfo>` : Objet contenant nom et métadonnées des colonnes

**Structure de retour** :
```typescript
{
    name: string,           // Nom de la table
    columns: ColumnInfo[]   // Array des informations de colonnes
}
```

**Implémentation** :
1. **Connexion temporaire** : Pattern cohérent avec les autres méthodes
2. **Requête qualifiée** : `DESCRIBE \`database\`.\`tableName\``
3. **Mapping des données** : Transformation des résultats MySQL vers `ColumnInfo`
4. **Gestion des types** : Préservation des informations de contraintes et types

**Mapping des colonnes MySQL → ColumnInfo** :
```typescript
{
    name: row.Field,        // Nom de la colonne
    type: row.Type,         // Type MySQL complet (ex: VARCHAR(255))
    nullable: row.Null === 'YES',  // Null autorisé
    key: row.Key || '',     // Type de clé (PRI/UNI/MUL)
    default: row.Default,   // Valeur par défaut
    extra: row.Extra || ''  // AUTO_INCREMENT, etc.
}
```

**Utilisation** :
- **DaoGeneratorService** : Génération des classes PHP DAO
- **Analyse de schéma** : Détermination des types PHP correspondants
- **Validation** : Génération des contraintes de validation

---

### `disconnectAll(): Promise<void>`

**Rôle** : Ferme toutes les connexions actives du pool en parallèle.

**Implémentation** :
```typescript
const disconnectPromises = Array.from(this.connections.keys())
    .map(id => this.disconnect(id));
await Promise.all(disconnectPromises);
```

**Utilisation** :
- **Désactivation d'extension** : Nettoyage automatique
- **Reset complet** : Fermeture de toutes les connexions

**Avantage** : Fermeture en parallèle pour performance optimale.

---

## Méthode Privée

### `createConnection(connection: DatabaseConnection): Promise<mysql.Connection>`

**Rôle** : Factory pour la création de connexions MySQL avec configuration standardisée.

**Configuration appliquée** :
```typescript
const config: mysql.ConnectionOptions = {
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: connection.password,
    database: connection.database,    // Optionnel
    connectTimeout: 10000            // 10 secondes
};
```

**Avantages** :
- **Centralisation** : Configuration unique pour toutes les connexions
- **Timeout cohérent** : Évite les blocages indefinis
- **Réutilisabilité** : Pattern DRY pour la création de connexions

---

## Patterns de Conception Utilisés

### 1. **Service Layer Pattern**
- Centralisation de la logique métier d'accès aux données
- Interface uniforme pour tous les composants clients

### 2. **Connection Pool Pattern**
- Gestion efficace des ressources de connexion
- Réutilisation des connexions établies

### 3. **Temporary Connection Pattern**
- Connexions dédiées pour opérations ponctuelles (`getDatabases`, `getTables`, `getTableInfo`)
- Évite la pollution du pool principal

### 4. **Error Boundary Pattern**
- Gestion centralisée des erreurs avec logging
- Propagation contrôlée vers les couches supérieures

---

## Gestion des Erreurs

### Stratégies par méthode
- **testConnection** : Capture et retourne `false`, pas d'exception
- **connect/disconnect** : Logging + propagation d'erreurs
- **getDatabases/getTables/getTableInfo** : Logging + propagation avec contexte

### Types d'erreurs gérées
- **Erreurs de réseau** : Timeout, connexion refusée
- **Erreurs d'authentification** : Credentials invalides
- **Erreurs SQL** : Syntaxe, permissions, bases inexistantes
- **Erreurs système** : Ressources, mémoire

---

## Optimisations et Performance

### 1. **Connexions temporaires**
- Évite l'accumulation de connexions inutilisées
- Libération immédiate des ressources

### 2. **Requêtes qualifiées**
- `SHOW TABLES FROM database` au lieu de `USE database; SHOW TABLES`
- `DESCRIBE database.table` au lieu de `USE database; DESCRIBE table`
- Évite les changements d'état de connexion

### 3. **Pool de connexions**
- Réutilisation des connexions pour opérations fréquentes
- Évite le overhead de création/destruction

### 4. **Fermeture parallèle**
- `disconnectAll()` utilise `Promise.all()` pour efficacité

---

## Intégrations avec les autres composants

### ConnectionFormPanel
- **testConnection()** : Validation temps réel des formulaires
- **getDatabases()** : Chargement dynamique des listes de bases

### DatabaseConnectionProvider  
- **connect()/disconnect()** : Gestion des états de connexion
- **getDatabases()** : Construction de l'arbre hiérarchique
- **getTables()** : Expansion des nœuds de base de données

### TableSelectionPanel
- **getTables()** : Liste des tables disponibles pour génération
- **getTableInfo()** : Indirect via DaoGeneratorService

### DaoGeneratorService
- **getTableInfo()** : Métadonnées pour génération des classes DAO
- **Injection de dépendance** : Constructeur prend DatabaseService

---

## Évolutions et Extensibilité

### Extensions possibles
1. **Support PostgreSQL** : Ajout d'un factory pattern pour différents drivers
2. **Cache de métadonnées** : Mise en cache des informations de schéma
3. **Connexions SSL** : Support des connexions sécurisées
4. **Pool avancé** : Gestion de pool avec limites et rotation
5. **Monitoring** : Métriques de performance et santé des connexions

### Architecture évolutive
La classe est conçue pour extension sans modification (Open/Closed Principle) :
- Interface stable et bien définie
- Gestion d'erreurs robuste
- Patterns de conception éprouvés
