---
applyTo: '**/*.ts'
---
Project TypeScript conventions and generation rules (appliquées automatiquement) :

1. Typage strict
    - Évite `any`. Utilise des types explicites pour tous les paramètres et les retours.
    - Préfère `Promise<T>` plutôt que `Promise<any>` ou `Promise`.
    - Tous les exports doivent avoir une signature typée.

2. JSDoc obligatoire
    - Si une fonction exportée (ou toute fonction publique) n'a pas de JSDoc, Génère-en une complète :
        - `@param {type} name description`
        - `@returns {type} description`
        - `@memberof` si applicable
    - Ne change pas la logique métier sans l’expliquer dans la JSDoc.

3. Style & patterns
    - Préfère `const` > `let` > `var`.
    - Utilise `async/await` plutôt que callbacks.
    - Centralise la gestion des erreurs (utiliser `ErrorHandler` quand présent).
    - Pas de valeurs sensibles hardcodées (clé, mot de passe, token, chemin absolu).

4. Sécurité
    - Valide toutes les entrées venant de la webview.
    - N’expose jamais de secrets dans `console.log`.
    - Utilise `vscode.SecretStorage` pour secrets locaux (si une clé maître est requise).

<!-- 5. Tests & documentation
    - Propose ou ajoute des tests unitaires quand une modification touche la logique métier.
    - Ajoute un commentaire bref « TODO: add unit tests » lorsqu’un refactor modifie un comportement critique. -->

6. Code generation / refactor
    - Lors d’un refactor proposer d’abord un patch minimal (diff) + tests d’intégration potentiels.
