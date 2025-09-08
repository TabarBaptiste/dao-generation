# Documentation Technique - PHP DAO Generator

Cette documentation technique détaille l'architecture et le fonctionnement interne de l'extension VS Code "PHP DAO Generator". Chaque fichier source du projet possède sa documentation dédiée expliquant son rôle, ses méthodes et ses interactions.

---

## 📁 Structure de la documentation

La documentation suit l'arborescence du code source pour faciliter la navigation :

```
docs/
├── README.md                          (ce fichier)
├── extension.md                       (point d'entrée principal)
├── services/                          (logique métier)
│   ├── ConnectionManager.md          (gestion des connexions)
│   ├── DatabaseService.md            (accès base de données)
│   └── DaoGeneratorService.md        (génération fichiers DAO)
├── panels/                            (interfaces utilisateur)
│   ├── ConnectionFormPanel.md        (formulaire de connexion)
│   └── TableSelectionPanel.md        (sélection tables + génération)
├── providers/                         (fournisseurs de données)
│   └── DatabaseConnectionProvider.md (arbre de navigation)
└── types/                            (définitions TypeScript)
    └── types.md                      (interfaces et types)
```

---

## 🎯 Guide de navigation

### Par rôle dans l'architecture

#### **Couche de présentation (UI)**
- [`extension.md`](./extension.md) - Point d'entrée et orchestration VS Code
- [`providers/DatabaseConnectionProvider.md`](./providers/DatabaseConnectionProvider.md) - Arbre de navigation sidebar
- [`panels/ConnectionFormPanel.md`](./panels/ConnectionFormPanel.md) - Formulaires de connexion  
- [`panels/TableSelectionPanel.md`](./panels/TableSelectionPanel.md) - Interface de génération DAO

#### **Couche service (Business Logic)**
- [`services/ConnectionManager.md`](./services/ConnectionManager.md) - CRUD des connexions + export/import
- [`services/DatabaseService.md`](./services/DatabaseService.md) - Accès MySQL/MariaDB
- [`services/DaoGeneratorService.md`](./services/DaoGeneratorService.md) - Génération classes PHP

#### **Couche données (Types & Interfaces)**
- [`types/types.md`](./types/types.md) - Définitions TypeScript (DatabaseConnection, TableInfo, etc.)

### Par cas d'usage

#### **🔌 Gestion des connexions**
1. [`panels/ConnectionFormPanel.md`](./panels/ConnectionFormPanel.md) - Création/édition formulaires
2. [`services/ConnectionManager.md`](./services/ConnectionManager.md) - Persistance et chiffrement
3. [`providers/DatabaseConnectionProvider.md`](./providers/DatabaseConnectionProvider.md) - Affichage dans l'arbre

#### **🗄️ Navigation base de données**  
1. [`services/DatabaseService.md`](./services/DatabaseService.md) - Connexions MySQL et métadonnées
2. [`providers/DatabaseConnectionProvider.md`](./providers/DatabaseConnectionProvider.md) - Arbre hiérarchique
3. [`panels/TableSelectionPanel.md`](./panels/TableSelectionPanel.md) - Sélection des tables

#### **⚡ Génération de DAO**
1. [`panels/TableSelectionPanel.md`](./panels/TableSelectionPanel.md) - Interface de sélection
2. [`services/DaoGeneratorService.md`](./services/DaoGeneratorService.md) - Génération PHP
3. [`services/DatabaseService.md`](./services/DatabaseService.md) - Métadonnées des tables

---

## 🏗️ Architecture globale

### Vue d'ensemble des composants

```
┌─────────────────────────────────────────────────────────────────────┐
│                          VS Code Extension                           │
├─────────────────────────────────────────────────────────────────────┤
│  extension.ts (Point d'entrée et orchestration)                     │
├──────────────────────┬────────────────────┬─────────────────────────┤
│    Presentation      │    Services        │       Data Layer        │
├──────────────────────┼────────────────────┼─────────────────────────┤
│ DatabaseConnection   │ ConnectionManager  │ DatabaseConnection      │
│ Provider (TreeView)  │ (CRUD + Persist)   │ ConnectionFormData      │
├──────────────────────┼────────────────────┼─────────────────────────┤
│ ConnectionFormPanel  │ DatabaseService    │ TableInfo               │
│ (Webview)           │ (MySQL Access)     │ ColumnInfo              │
├──────────────────────┼────────────────────┼─────────────────────────┤
│ TableSelectionPanel │ DaoGeneratorService │                         │
│ (Webview)           │ (PHP Generation)    │                         │
└──────────────────────┴────────────────────┴─────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │   MySQL/MariaDB         │
                    │   Database Server       │
                    └─────────────────────────┘
```

### Flux de données principaux

#### **1. Ajout de connexion**
```
User → ConnectionFormPanel → ConnectionManager → DatabaseConnectionProvider
     ←                   ←                   ← (refresh tree)
```

#### **2. Navigation base de données**
```
User → DatabaseConnectionProvider → DatabaseService → MySQL/MariaDB
     ←                           ← (databases/tables) ←
```

#### **3. Génération DAO**
```
User → TableSelectionPanel → DaoGeneratorService → DatabaseService → MySQL
                                                ↓
                                           PHP DAO Files
```

---

## 📋 Standards de documentation

Chaque fichier de documentation suit un template cohérent :

### **1. Vue d'ensemble**
- Rôle général du fichier dans l'extension
- Contexte d'utilisation et responsabilités

### **2. Classe(s) / Fonction(s) principale(s)**
- Nom et description générale  
- Paramètres du constructeur
- Variables importantes et leur rôle

### **3. Méthodes / Fonctions internes**
- Signature complète (nom, paramètres, types)
- Valeur de retour et explication
- Logique interne détaillée
- Exemples d'appel concrets

### **4. Liaisons avec d'autres fichiers** 
- Qui appelle ce fichier (dépendances entrantes)
- Quels fichiers il importe/utilise (dépendances sortantes)

### **5. Logique / Algorithme clé**
- Étapes de traitement importantes
- Patterns de conception utilisés
- Décisions architecturales

### **6. Exemples d'utilisation**
- Cas concrets d'utilisation dans l'extension
- Workflow complets avec code d'exemple

---

## 🔧 Technologies et patterns utilisés

### **Technologies principales**
- **TypeScript** - Langage principal avec typage strict
- **VS Code Extension API** - Intégration native VS Code
- **MySQL2/Promise** - Driver de base de données asynchrone
- **Node.js modules** - fs, path, crypto pour opérations système

### **Patterns architecturaux**
- **Injection de dépendances** - Services découplés via constructeurs
- **Observer Pattern** - EventEmitter pour rafraîchissement d'arbre  
- **Singleton Pattern** - Panels webview avec réutilisation intelligente
- **Command Pattern** - Commandes VS Code avec handlers découplés
- **MVC Pattern** - Séparation UI (webview) / Logic (services) / Data (types)

### **Patterns VS Code spécifiques**
- **TreeDataProvider** - Fournisseur de données pour sidebar
- **WebviewPanel** - Interfaces utilisateur riches
- **Extension Context** - Stockage persistant et lifecycle
- **Command Registration** - Intégration Command Palette et menus

---

## 🚀 Points d'entrée pour développeurs

### **Nouveaux développeurs - Par où commencer ?**

1. **[`extension.md`](./extension.md)** - Comprendre le point d'entrée et l'initialisation
2. **[`types/types.md`](./types/types.md)** - Maîtriser les structures de données  
3. **[`services/DatabaseService.md`](./services/DatabaseService.md)** - Comprendre l'accès aux données
4. **[`providers/DatabaseConnectionProvider.md`](./providers/DatabaseConnectionProvider.md)** - Interface principale utilisateur

### **Ajouter une nouvelle fonctionnalité**

- **Nouvelle base de données ?** → [`services/DatabaseService.md`](./services/DatabaseService.md)
- **Nouveau type de DAO ?** → [`services/DaoGeneratorService.md`](./services/DaoGeneratorService.md) 
- **Nouvelle interface ?** → [`panels/`](./panels/) pour patterns webview
- **Nouvelle commande ?** → [`extension.md`](./extension.md) pour enregistrement

### **Déboguer un problème**

- **Problème connexion ?** → [`services/DatabaseService.md`](./services/DatabaseService.md) + [`services/ConnectionManager.md`](./services/ConnectionManager.md)
- **Interface ne répond pas ?** → [`panels/`](./panels/) pour communication webview
- **Arbre non rafraîchi ?** → [`providers/DatabaseConnectionProvider.md`](./providers/DatabaseConnectionProvider.md)
- **Génération échouée ?** → [`services/DaoGeneratorService.md`](./services/DaoGeneratorService.md)

---

## 📚 Conventions et bonnes pratiques

### **Conventions de nommage**
- **Classes** : PascalCase (`DatabaseService`, `ConnectionManager`)
- **Méthodes publiques** : camelCase (`addConnection`, `generateDaoFiles`)  
- **Méthodes privées** : camelCase avec underscore (`_getHtmlForWebview`)
- **Interfaces** : PascalCase (`DatabaseConnection`, `ConnectionFormData`)

### **Gestion des erreurs**
- Try/catch systématique avec messages utilisateur explicites
- Logs console.error pour debug développeur
- Messages VS Code (`showErrorMessage`) pour utilisateur final

### **Communication webview**
- Messages structurés avec `command` obligatoire
- Données typées dans propriété `data` ou propriétés dédiées  
- Gestion bidirectionnelle avec handlers séparés

### **Architecture évolutive**
- Services injectés via constructeur (pas d'instanciation directe)
- Interfaces TypeScript pour contrats stables
- Séparation claire présentation/logique/données

Cette documentation évolue avec le code. N'hésitez pas à la maintenir à jour lors de vos modifications ! 🔄