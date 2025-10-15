# 🔄 Configuration CircleCI pour PHP DAO Generator

## 📋 Vue d'ensemble

Cette configuration CircleCI provides une pipeline complète pour votre extension VS Code avec build, tests, packaging et publication.

## 🏗️ Structure de la Pipeline

### 1. **Code Quality** (`code-quality`)
- Compilation TypeScript avec `npm run compile`
- Vérification du linting (si script disponible)
- Cache des dépendances npm pour optimisation

### 2. **Build** (`build`)
- Build de l'extension avec esbuild (`npm run build:esbuild`)
- Génération des artifacts dans `dist/`
- Persistance des fichiers buildés

### 3. **Test** (`test`)
- Exécution des tests VS Code (si disponibles)
- Support pour tests headless avec Xvfb
- Environment variables pour CI

### 4. **Package** (`package`)
- Création du package VSIX avec vsce
- Listing du contenu du package
- Stockage des artifacts pour téléchargement

### 5. **Publish** (`publish`) - Conditionnel
- Publication sur VS Code Marketplace
- Nécessite le token `VSCE_TOKEN`
- Avec étape d'approbation manuelle

### 6. **Release** (`release`)
- Utilise semantic-release pour gestion automatique des versions
- Génération du CHANGELOG
- Tags Git automatiques

## 🔄 Workflows

### **build-and-test** (tous les commits)
```
code-quality → build → test → package
```
- S'exécute sur toutes les branches sauf `gh-pages`
- Vérifie la qualité et crée le package

### **publish-extension** (main branch uniquement)
```
code-quality → build → test → package → [APPROVAL] → publish → release
```
- S'exécute uniquement sur `main`
- Nécessite approbation manuelle avant publication
- Publication automatique après approbation

### **nightly-build** (programmé)
```
code-quality → build → test → package
```
- S'exécute tous les jours à 2h du matin
- Vérification de la stabilité du projet

## ⚙️ Configuration requise

### Variables d'environnement CircleCI
```bash
VSCE_TOKEN=your_vscode_marketplace_token
GITHUB_TOKEN=your_github_token  # Pour semantic-release
```

### Scripts package.json requis
```json
{
  "scripts": {
    "compile": "tsc -p ./",
    "build:esbuild": "node esbuild.js --production",
    "vsce:package": "vsce package --no-update-package-json",
    "test": "node ./out/test/runTest.js",  // Optionnel
    "release": "semantic-release"           // Optionnel
  }
}
```

## 🚀 Mise en route

### 1. **Connecter votre repo à CircleCI**
- Aller sur [CircleCI](https://app.circleci.com/)
- Connecter votre compte GitHub
- Ajouter votre projet `dao-generation`

### 2. **Configurer les variables d'environnement**
```bash
# Dans CircleCI Project Settings > Environment Variables
VSCE_TOKEN=your_marketplace_token
GITHUB_TOKEN=your_github_token
```

### 3. **Premier build**
- Pusher le fichier `.circleci/config.yml`
- CircleCI démarre automatiquement le build

## 📊 Monitoring et Artifacts

### **Artifacts disponibles**
- 📦 **Packages VSIX** : Téléchargeables depuis l'interface CircleCI
- 📝 **Logs détaillés** : Pour chaque étape du build
- 📈 **Métriques** : Temps d'exécution, cache hit rates

### **Notifications**
- ✅ **Succès** : Email/Slack en cas de build réussi
- ❌ **Échecs** : Notifications immédiates pour débugger
- 🔔 **Approbations** : Notification pour publication manuelle

## 🔧 Optimisations incluses

- **Cache npm** : Réutilisation des `node_modules` entre builds
- **Workspace persistence** : Partage d'artifacts entre jobs
- **Parallel execution** : Jobs indépendants en parallèle
- **Conditional steps** : Exécution uniquement si nécessaire

## 🆚 Comparaison avec GitHub Actions

| Aspect | CircleCI | GitHub Actions |
|--------|----------|----------------|
| **Performance** | ⭐⭐⭐⭐ Cache avancé | ⭐⭐⭐ Cache standard |
| **Interface** | ⭐⭐⭐⭐⭐ Dashboard riche | ⭐⭐⭐ Interface simple |
| **Debugging** | ⭐⭐⭐⭐⭐ SSH debug | ⭐⭐ Logs uniquement |
| **Pricing** | 🔸 Free tier limité | ✅ Free tier généreux |
| **Workflows** | ⭐⭐⭐⭐⭐ Très flexibles | ⭐⭐⭐⭐ Flexibles |

## 🎯 Recommandations

### **Développement quotidien**
- Utilisez **GitHub Actions** pour simplicité
- CircleCI pour tests approfondis et releases importantes

### **Production/Release**
- CircleCI pour robustesse et monitoring avancé
- Interface graphique pour suivi des déploiements

### **Test des deux**
- Gardez les deux configurations
- Comparez les performances et stabilité
- Choisissez selon vos besoins