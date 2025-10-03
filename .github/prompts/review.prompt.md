---
mode: agent
---
You are asked to perform an in-depth **code review** of the currently opened file in the repo. Use the project's evaluation grid located at `aide/eval.md` to produce a structured review.

**Deliverables (strict format)**:
1. **Résumé (1-2 lines)** — état général du fichier.
2. **Scores** — note /10 pour chaque critère de `aide/eval.md` :
    - Lisibilité: X/10
    - Documentation interne: X/10
    - Structure & Organisation: X/10
    - Sécurité & Robustesse: X/10
    - UX (ou N/A): X/10
    - Performance: X/10
    - Évolutivité / Maintenabilité: X/10

3. **Problèmes majeurs** (liste priorisée) — 3 premiers problèmes critiques + pourquoi.
4. **Améliorations recommandées** (priorisées) — actions concrètes à appliquer (1 … n).
<!-- 5. **Patchs / diffs** — proposer **jusqu'à 3** patches (minimal, moyen, maximal). Fournir les modifications sous forme de `git diff` ou patch à appliquer. -->
5. **Check-list de sécurité** — items vérifiés et résultats (ex : "Pas de clé hardcodée: OK/KO").
6. **Critères d'acceptation** — comment valider que chaque correction est OK (tests, manuelles, attentes).

**Règles d'analyse**:
- Utilise ton rôle d’expert TypeScript / sécurité.
- Applique les règles du `.github/instructions/*.instructions.md`.
- Pour la recherche de duplications, recherche fonctions qui répètent la même logique et propose une extraction commune.
- Pour chaque changement proposé, indique l’impact (risk / breaking change).
- Si un refactor change le comportement, propose un test unitaire minimal.

**Sortie**: 1 seule réponse structurée selon les sections ci-dessus. Evite le verbiage non-structuré.
