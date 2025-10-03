---
applyTo: 'src/webview/**/*.js'
---
Webview / client-side JS guidelines :

1. JSDoc
    - Si une fonction ne possède pas de JSDoc, génère-en une courte.
    - Inclure `@param` et `@returns` si applicable.

2. Robustesse UI
    - Valider les valeurs des formulaires avant d'envoyer à l'extension.
    - Ne jamais inclure de secrets (API keys) dans le HTML/JS du webview.
    - Utiliser `postMessage` structuré `{ command: string, data?: any }` pour toutes les communications.

3. Accessibilité
    - Buttons focusable, labels associés via `for` / `id`, aria-live pour messages asynchrones.
