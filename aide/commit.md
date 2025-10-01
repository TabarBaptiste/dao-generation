# 📑 Cheatsheet Conventional Commits

### 🔧 **fix** (correction de bug)

> Correction qui répare un comportement inattendu.

```bash
git commit -m "fix: vérification des doublons lors de l'ajout d'une connexion"
```

---

### ✨ **feat** (nouvelle fonctionnalité)

> Ajout d'une fonctionnalité visible pour l’utilisateur.

```bash
git commit -m "feat: ouverture automatique du projet correspondant à la BDD sélectionnée"
```

---

### 📚 **docs** (documentation)

> Changements dans la doc (README, wiki, commentaires, JSDoc).

```bash
git commit -m "docs: ajout de commentaires explicatifs dans ConnectionManager"
```

---

### 🎨 **style** (mise en forme)

> Changements qui n'affectent pas le code (indentation, espaces, points-virgules).

```bash
git commit -m "style: normalisation de l'indentation dans extension.ts"
```

---

### 🧹 **refactor** (refactorisation)

> Amélioration du code sans changer le comportement.

```bash
git commit -m "refactor: factorisation de la logique de connexion dans une fonction utilitaire"
```

---

### ✅ **test** (tests)

> Ajout ou modification de tests unitaires ou fonctionnels.

```bash
git commit -m "test: ajout de tests unitaires pour DatabaseConnectionFactory"
```

---

### ⚙️ **chore** (tâches techniques)

> Choses qui n’affectent pas directement le code source ou l’utilisateur (dépendances, config, CI/CD).

```bash
git commit -m "chore: mise à jour de semantic-release à la dernière version"
```

---

### 🚀 **perf** (performance)

> Optimisation des performances sans ajout de feature.

```bash
git commit -m "perf: amélioration du temps de chargement des bases de données"
```

---

### 🔒 **security** (sécurité) *(facultatif mais utile pour ton projet)*

> Corrections liées à la sécurité.

```bash
git commit -m "security: chiffrement des mots de passe exportés"
```

---

👉 **Rappel pratique :**

* **feat** → nouvelle version *mineure* (1.3.0 → 1.4.0)
* **fix** → nouvelle version *patch* (1.3.0 → 1.3.1)
* **docs, style, refactor, chore, test** → pas de version bump (sauf si tu le forces)
