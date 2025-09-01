
```
dao-generation/
├─ src/
│  ├─ extension.ts        # Point d'entrée
│  ├─ projectManager.ts   # Gestion des projets (création, sélection)
│  ├─ dbConnector.ts      # Connexion et introspection SQL
│  ├─ daoGenerator.ts     # Génération des fichiers PHP DAO
│  ├─ ui/
│  │   ├─ projectForm.ts  # UI Webview création projet
│  │   ├─ tableSelector.ts # UI Webview sélection tables
├─ .dao-generator.json    # Config projets
├─ package.json           # Déclaration extension
├─ tsconfig.json
```