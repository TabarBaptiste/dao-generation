## [1.8.2](https://github.com/TabarBaptiste/dao-generation/compare/v1.8.1...v1.8.2) (2025-10-17)


### Bug Fixes

* mise à jour de la version de la dépendance typescript, meilleur gestion des erreurs dans Sentry ([c407c6e](https://github.com/TabarBaptiste/dao-generation/commit/c407c6ebabcb8d1a6e5510f3b74dad5bb09ce795))

## [1.8.1](https://github.com/TabarBaptiste/dao-generation/compare/v1.8.0...v1.8.1) (2025-10-15)


### Bug Fixes

* ajustement du chemin d'accès au package.json pour Sentry ([ad134c5](https://github.com/TabarBaptiste/dao-generation/commit/ad134c594d413f6fa5073493c6d7171d7719d55e))
* comment avant ([17be8a7](https://github.com/TabarBaptiste/dao-generation/commit/17be8a7430f2512aa79ec5a037698c88bdcb352c))
* mise à jour de la logique de publication dans les workflows ([8d1d941](https://github.com/TabarBaptiste/dao-generation/commit/8d1d94108c553093bb764937a6d9d0f77ea85812))

## [1.7.6](https://github.com/TabarBaptiste/dao-generation/compare/v1.7.5...v1.7.6) (2025-10-13)


### Bug Fixes

* ajout de la correspondance de dossiers par similarité et amélioration de la gestion des chemins ([0745f6a](https://github.com/TabarBaptiste/dao-generation/commit/0745f6a44734ee7af9bee2a8ee72508678ecc6ea))

## [1.7.5](https://github.com/TabarBaptiste/dao-generation/compare/v1.7.4...v1.7.5) (2025-10-06)


### Bug Fixes

* supprimer la règle de longueur maximale de l'en-tête dans la configuration de commitlint ([af8984b](https://github.com/TabarBaptiste/dao-generation/commit/af8984b8d467935789d7aea037e2a6db62f93ab0))

## [1.7.4](https://github.com/TabarBaptiste/dao-generation/compare/v1.7.3...v1.7.4) (2025-10-06)


### Bug Fixes

* Ajout d'un commentaire sur la PR en cas d'échec des vérifications automatiques ([37b8e56](https://github.com/TabarBaptiste/dao-generation/commit/37b8e5698c2dd385c32274f7cafc36ed38e8eae5))
* Correction de la version de Node.js et suppression de la condition d'exécution des tests ([1350363](https://github.com/TabarBaptiste/dao-generation/commit/1350363fded8cb2151cc90cfc31dff88e9a4f7df))
* échappement des backticks dans le rapport de vérification de code ([a9b6e32](https://github.com/TabarBaptiste/dao-generation/commit/a9b6e3215142f086c076aacbe925486287c8dd45))
* Erreur volontaire ([2f3e735](https://github.com/TabarBaptiste/dao-generation/commit/2f3e735d5a7d711ec88d3248cc6ba326fa22db7a))
* mise à jour des commentaires de la revue automatique et amélioration des suggestions ([faf279c](https://github.com/TabarBaptiste/dao-generation/commit/faf279c9e152734b92a671a6d0dfd88291ec2b9b))
* Mise à jour des vérifications de PR avec gestion de la concurrence et amélioration de la configuration des tests ([a4c4062](https://github.com/TabarBaptiste/dao-generation/commit/a4c40623514b74b6d2a3cb0216ddb8ad38217997))
* simple test de workflow ([24e158e](https://github.com/TabarBaptiste/dao-generation/commit/24e158ed1be6eaa0032b1441c8ce2164df10565e))
* Suppression de la condition d'exécution des tests ([9004598](https://github.com/TabarBaptiste/dao-generation/commit/9004598bc04be8f01fe9cc1d1f8b366df8f81f7d))
* suppression de la vérification des types 'any' dans le workflow de révision de code ([6c4f107](https://github.com/TabarBaptiste/dao-generation/commit/6c4f107acf9634dcb8cb751098c719b9a3bf5dc2))
* Suppression de npm run lint ([7c2dc15](https://github.com/TabarBaptiste/dao-generation/commit/7c2dc15e0a54977f0de93013d87f75671aab1373))

## [1.7.3](https://github.com/TabarBaptiste/dao-generation/compare/v1.7.2...v1.7.3) (2025-10-03)


### Bug Fixes

* Utilisation de testConnection lors du chargement automatique ([aa6b4a3](https://github.com/TabarBaptiste/dao-generation/commit/aa6b4a35cc2de8633550295bd4a85d4ecef70db9))

## [1.7.2](https://github.com/TabarBaptiste/dao-generation/compare/v1.7.1...v1.7.2) (2025-10-03)


### Performance Improvements

* Amélioration du trie pour la recherche des tables ([ad0429f](https://github.com/TabarBaptiste/dao-generation/commit/ad0429fb520188aafd6b8989d554c761ee0abbe6))

## [1.7.1](https://github.com/TabarBaptiste/dao-generation/compare/v1.7.0...v1.7.1) (2025-10-03)


### Bug Fixes

* refactoring + ajout de l'algorithme de Levenshtein dans la recherche des tables ([0ba7905](https://github.com/TabarBaptiste/dao-generation/commit/0ba79052c8ba0ee7f15d1cbe974eeb8492684042))

# [1.7.0](https://github.com/TabarBaptiste/dao-generation/compare/v1.6.4...v1.7.0) (2025-10-02)


### Features

* ajout de la fonctionnalité de recherche dans la sélection des tables resolved [#24](https://github.com/TabarBaptiste/dao-generation/issues/24) ([9f65ecd](https://github.com/TabarBaptiste/dao-generation/commit/9f65ecd7ac943db8bd6aefb273a5745f09c1eaa2))

## [1.6.4](https://github.com/TabarBaptiste/dao-generation/compare/v1.6.3...v1.6.4) (2025-09-30)


### Bug Fixes

* Nom de l'utilisateur qui génère le fichier DAO dans [@author](https://github.com/author) ([0465c8d](https://github.com/TabarBaptiste/dao-generation/commit/0465c8df4486590ad3e8f4f4d402ba9c8854935a))
* suppression de console.log ([d52150b](https://github.com/TabarBaptiste/dao-generation/commit/d52150ba78d968cdd90056979879a762e6c5e1fc))

## [1.6.3](https://github.com/TabarBaptiste/dao-generation/compare/v1.6.2...v1.6.3) (2025-09-30)


### Bug Fixes

* conn --> serv ([3978813](https://github.com/TabarBaptiste/dao-generation/commit/39788130240b4b8983246b9d7ae998291938e089))
* Constate WAMP_WWW et LOCAL_CLASSES au bon format ([6ddbca6](https://github.com/TabarBaptiste/dao-generation/commit/6ddbca604c1b009fbd7a9221e6b0ff727f451fdd))
* nombre de serveur correctement récupéré pour toggleSortMode() ([5751db3](https://github.com/TabarBaptiste/dao-generation/commit/5751db30d0b2349ba826790c6d12d4591a68c23a))
* refactoring de la fonction de chiffrement des mots de passe des serveurs ([de8763f](https://github.com/TabarBaptiste/dao-generation/commit/de8763fbdac673453b2a0a488aa5b6d5f31ea993))
* Remplacer toutes les occurrences de "connexion" par "serveur" dans le code. Et plus de "Fusion" ou "Remplacement" lors de l'importation ([281161b](https://github.com/TabarBaptiste/dao-generation/commit/281161bd34858c23c39e3fe8ce244bcb9ecf07e5))
* suppression de @BDD et [@table](https://github.com/table), et suppression du prefix de la table ([0718b0e](https://github.com/TabarBaptiste/dao-generation/commit/0718b0e9236c3bee903289e036aa57a3d595a82b))

## [1.6.2](https://github.com/TabarBaptiste/dao-generation/compare/v1.6.1...v1.6.2) (2025-09-29)


### Bug Fixes

* Désélectionner toutes les tables après la génération ([db658da](https://github.com/TabarBaptiste/dao-generation/commit/db658da387e0a5233a60b2227211ac0d695e2959))
* isConnected = true après update si test OK ([9bcdf77](https://github.com/TabarBaptiste/dao-generation/commit/9bcdf77b65008585d99568cb2f3beeae0dd2269b))

## [1.6.1](https://github.com/TabarBaptiste/dao-generation/compare/v1.6.0...v1.6.1) (2025-09-26)


### Bug Fixes

* Test la connexion au reload ([3dd280b](https://github.com/TabarBaptiste/dao-generation/commit/3dd280b230211626f67aec73a080807d2084865d))

# [1.6.0](https://github.com/TabarBaptiste/dao-generation/compare/v1.5.9...v1.6.0) (2025-09-25)


### Features

* ajouter la gestion du chemin par défaut pour la génération des DAO lorsqu'une BDD sélectionner pour le serveur ([24e010f](https://github.com/TabarBaptiste/dao-generation/commit/24e010fa0a23050429e8ce1e70d6a5763aa84054))

## [1.5.9](https://github.com/TabarBaptiste/dao-generation/compare/v1.5.8...v1.5.9) (2025-09-25)


### Bug Fixes

* tester la connexion avant de marquer comme connectée lors de l'ajout ([15244c0](https://github.com/TabarBaptiste/dao-generation/commit/15244c003dbe0822e57ae955e262c7d2fe619cf6))
* tester la connexion avant de trier ([901a313](https://github.com/TabarBaptiste/dao-generation/commit/901a313a4a39d273da59e90ac8b5dd74f35d9bbf))

## [1.5.8](https://github.com/TabarBaptiste/dao-generation/compare/v1.5.7...v1.5.8) (2025-09-25)


### Bug Fixes

* ignore fichiers .vscode - remove from tracking ([59982a1](https://github.com/TabarBaptiste/dao-generation/commit/59982a183d9cf19bceb72438dc6de50e875c12e2))
* Serveurs enregistrés globalement, et plus pour un utilisateur ([67d3009](https://github.com/TabarBaptiste/dao-generation/commit/67d3009258a5a79b0c3e2e9031d74721636b0d7c))

## [1.5.7](https://github.com/TabarBaptiste/dao-generation/compare/v1.5.6...v1.5.7) (2025-09-25)


### Bug Fixes

* Corrections mineurs ([a0c2dd4](https://github.com/TabarBaptiste/dao-generation/commit/a0c2dd429980bbd5a428ffa1c6775756d9c7f967))
* Serveurs enregistrés globalement, et plus pour un utilisateur ([b6d7c86](https://github.com/TabarBaptiste/dao-generation/commit/b6d7c86493f444b0c520df01ea07ddbae04ab64d))
* Traduction de l'anglais au français ([4b94fd5](https://github.com/TabarBaptiste/dao-generation/commit/4b94fd5e741be79721ec279f7fc0f61ad8f39ba3))

## [1.5.6](https://github.com/TabarBaptiste/dao-generation/compare/v1.5.5...v1.5.6) (2025-09-23)


### Bug Fixes

* Nouvel icône pour port ([440cfaa](https://github.com/TabarBaptiste/dao-generation/commit/440cfaa11aa7c05b7608774bb7bb02396bd8728a))

## [1.5.5](https://github.com/TabarBaptiste/dao-generation/compare/v1.5.4...v1.5.5) (2025-09-22)


### Bug Fixes

* Amélioration de la gestion des erreurs lors du test de connexion à la base de données ([1503389](https://github.com/TabarBaptiste/dao-generation/commit/1503389d7f95e1467cbb118c8e51d178d2663446))
* Refactor des tests de connexion ([211b3ac](https://github.com/TabarBaptiste/dao-generation/commit/211b3ac30c678eda34c8b9a66b167a9bab88515a))

## [1.5.4](https://github.com/TabarBaptiste/dao-generation/compare/v1.5.3...v1.5.4) (2025-09-22)


### Bug Fixes

* Ajout de nouvelles constantes pour les dossiers webview ([a3938a3](https://github.com/TabarBaptiste/dao-generation/commit/a3938a306f944dc35d47a4ae2559749ff55a156e))
* Suppression de console.log ([48f2f8f](https://github.com/TabarBaptiste/dao-generation/commit/48f2f8ffb1fe94e8ea6b6c77b89eec34d2f8da06))
* Traduction anglais --> français ([d60b465](https://github.com/TabarBaptiste/dao-generation/commit/d60b46503c876299f070809e2f86480dc263dacb))

## [1.5.3](https://github.com/TabarBaptiste/dao-generation/compare/v1.5.2...v1.5.3) (2025-09-18)


### Bug Fixes

* Ajout du champ mot de passe pour le chargement automatique des bases de données ([3fce867](https://github.com/TabarBaptiste/dao-generation/commit/3fce8670c3262e62940db74f146a1674234585f5))

## [1.5.2](https://github.com/TabarBaptiste/dao-generation/compare/v1.5.1...v1.5.2) (2025-09-18)


### Bug Fixes

* Affichage d'un message si aucun serveur retourné ([44ef1e6](https://github.com/TabarBaptiste/dao-generation/commit/44ef1e67b370fea15ee843b5aca640ad16dbe803))

## [1.5.1](https://github.com/TabarBaptiste/dao-generation/compare/v1.5.0...v1.5.1) (2025-09-16)


### Bug Fixes

* Ajout de la reconnexion automatique pour les connexions marquées comme connectées ([4e6ec6b](https://github.com/TabarBaptiste/dao-generation/commit/4e6ec6bb8d6293e92ad1f7f98f1cdf7446036c44))

# [1.5.0](https://github.com/TabarBaptiste/dao-generation/compare/v1.4.7...v1.5.0) (2025-09-15)


### Features

* Ajout d'icônes et amélioration de l'interface dans les formulaires de connexion et de sélection de table ([2cc3b8d](https://github.com/TabarBaptiste/dao-generation/commit/2cc3b8d5719162575de36b92257bf0cd74b3aeb2))

## [1.4.7](https://github.com/TabarBaptiste/dao-generation/compare/v1.4.6...v1.4.7) (2025-09-15)


### Bug Fixes

* Amélioration de l'interface de connexion avec des icônes et un bouton pour afficher/masquer le mot de passe ([f79db7f](https://github.com/TabarBaptiste/dao-generation/commit/f79db7fcd2c96cfffd9c72501f3eb455a668fe0b))

## [1.4.6](https://github.com/TabarBaptiste/dao-generation/compare/v1.4.5...v1.4.6) (2025-09-13)


### Bug Fixes

* Amélioration de l'import/export des connexions avec gestion des mots de passe chiffrés et non chiffrés ([af81c3b](https://github.com/TabarBaptiste/dao-generation/commit/af81c3baad292bde63b2c26c848ae6c699459166))
* Mise à jour des configurations de débogage et des tâches pour améliorer le développement de l'extension (à tester ([5ee1a50](https://github.com/TabarBaptiste/dao-generation/commit/5ee1a50c39aa860a18691f8a16f335c45fe423e2))
* Rendre le mot de passe facultatif dans les interfaces de connexion et ajuster la validation des champs ([50be6ee](https://github.com/TabarBaptiste/dao-generation/commit/50be6ee39ff1c6ccbcaac780ac19e7fa8ac9ed18))

## [1.4.5](https://github.com/TabarBaptiste/dao-generation/compare/v1.4.4...v1.4.5) (2025-09-12)


### Bug Fixes

* Mise à jour des traductions et des libellés dans l'interface utilisateur ([1797283](https://github.com/TabarBaptiste/dao-generation/commit/1797283b4a37bcee05ddb2e983f89fc8b08e4da9))

## [1.4.4](https://github.com/TabarBaptiste/dao-generation/compare/v1.4.3...v1.4.4) (2025-09-12)


### Bug Fixes

* Traduction de l'anglais au français resolved [#17](https://github.com/TabarBaptiste/dao-generation/issues/17) ([8188643](https://github.com/TabarBaptiste/dao-generation/commit/8188643278c79286cde42a755449dfb380b3c256))

## [1.4.3](https://github.com/TabarBaptiste/dao-generation/compare/v1.4.2...v1.4.3) (2025-09-12)


### Bug Fixes

* améliore la gestion du chargement des bases de données avec des messages contextuels et un chargement automatique ([f88b0ee](https://github.com/TabarBaptiste/dao-generation/commit/f88b0eebe5d2d0dbb36702422ba884fc5a0d37e3))
* refactor(ConnectionFormPanel) : simplifie la méthode d'affichage en supprimant les paramètres inutilisés ([876cced](https://github.com/TabarBaptiste/dao-generation/commit/876cced9fb9ed2e25c84bc03ec3596b32382fc0d))
* une base données affichée si une sélectionnée et réinitialise les bases de données en cas d'échec ([7e88bc3](https://github.com/TabarBaptiste/dao-generation/commit/7e88bc34347fd523968b319434fc7994761528db))

## [1.4.2](https://github.com/TabarBaptiste/dao-generation/compare/v1.4.1...v1.4.2) (2025-09-11)


### Bug Fixes

* Ajout de la vérification des doublons lors de l'ajout de connexions ([e3661cc](https://github.com/TabarBaptiste/dao-generation/commit/e3661cc4517f8619e65faa7145dd8b99bcdf0b45))
* Connection Name transparent ([8575837](https://github.com/TabarBaptiste/dao-generation/commit/8575837f8f84bc30818d710cd9fe4c59f3374c9d))
* Ouverture du projet correspond à à BDD sélectionnée resolved [#8](https://github.com/TabarBaptiste/dao-generation/issues/8) ([082bccd](https://github.com/TabarBaptiste/dao-generation/commit/082bccdb1995ccb3840ec91486ef165b4820c7a2))

## [1.4.1](https://github.com/TabarBaptiste/dao-generation/compare/v1.4.0...v1.4.1) (2025-09-11)


### Bug Fixes

* Ajout de la vérification des doublons lors de l'ajout de connexions ([4560a08](https://github.com/TabarBaptiste/dao-generation/commit/4560a087bb73205cbf6117f291b761cf4bcadba7))

# [1.4.0](https://github.com/TabarBaptiste/dao-generation/compare/v1.3.0...v1.4.0) (2025-09-10)


### Features

* Ajout de la fonctionnalité de tri des connexions par mode alphabétique ou date resolved [#11](https://github.com/TabarBaptiste/dao-generation/issues/11) ([15eff03](https://github.com/TabarBaptiste/dao-generation/commit/15eff03151021ee62c057f33c297ecb2ecd2f61e))

# [1.2.0](https://github.com/TabarBaptiste/dao-generation/compare/v1.1.5...v1.2.0) (2025-09-09)


### Features

* Ajout de la gestion intelligente des doublons lors de l'importation de connexions resolved [#12](https://github.com/TabarBaptiste/dao-generation/issues/12) ([1714d9a](https://github.com/TabarBaptiste/dao-generation/commit/1714d9af0c0df3e9f489683cba667b07ca8a1b96))

## [1.1.5](https://github.com/TabarBaptiste/dao-generation/compare/v1.1.4...v1.1.5) (2025-09-09)


### Bug Fixes

* Mot de passe crypté ([041b3f8](https://github.com/TabarBaptiste/dao-generation/commit/041b3f8b8508e82272c9e2b4535c0c91d799db64))

## [1.1.4](https://github.com/TabarBaptiste/dao-generation/compare/v1.1.3...v1.1.4) (2025-09-08)


### Bug Fixes

* Sélection du premier fichier généré dans l'explorateur de fichier et Suppression du préfixe de la table pour les requêtes SQL ([b2d078e](https://github.com/TabarBaptiste/dao-generation/commit/b2d078eefb95b240829b235cfd50bd54103c92b1))

## [1.1.3](https://github.com/TabarBaptiste/dao-generation/compare/v1.1.2...v1.1.3) (2025-09-08)


### Bug Fixes

* Désactiver le champ 'Connection Name' et ajouter la génération automatique du nom de connexion resolved [#1](https://github.com/TabarBaptiste/dao-generation/issues/1) ([67928c9](https://github.com/TabarBaptiste/dao-generation/commit/67928c9b46e2b048ded5bb2d20e78ce1010074c5))

## [1.1.2](https://github.com/TabarBaptiste/dao-generation/compare/v1.1.1...v1.1.2) (2025-09-08)


### Bug Fixes

* Corrige le traitement du port pour éviter la notation exponentielle et ajuste le type de données ([3321ea0](https://github.com/TabarBaptiste/dao-generation/commit/3321ea096f9b9235f0803ac0e1126288052cd22b))

## [1.1.1](https://github.com/TabarBaptiste/dao-generation/compare/v1.1.0...v1.1.1) (2025-09-08)


### Bug Fixes

* Changement des icônes pour l'importation et l'exportation des connexions ([a024664](https://github.com/TabarBaptiste/dao-generation/commit/a024664411317e5fb606b572524778ddfbaa7ae8))
* Changement des icônes pour l'importation et l'exportation des connexions ([9010ee0](https://github.com/TabarBaptiste/dao-generation/commit/9010ee0375ddfd1d10145c84fbe101bbb1cadc0d))

# [1.1.0](https://github.com/TabarBaptiste/dao-generation/compare/v1.0.0...v1.1.0) (2025-09-08)


### Bug Fixes

* Ajout de la documentation pour DatabaseService et Types ([a747ccd](https://github.com/TabarBaptiste/dao-generation/commit/a747ccd91edfbc6f8c160943ed753637d7478ac7))
* mise à jour de la version de Node.js à 22.x dans le workflow de publication ([961c088](https://github.com/TabarBaptiste/dao-generation/commit/961c088aa1c046db729f2bad7ba7e28e81c8a000))
* retirer la sélection par défaut des cases à cocher dans la liste des tables ([9962e71](https://github.com/TabarBaptiste/dao-generation/commit/9962e71f7bb63ad9c3e420095a9507415269e2ce))


### Features

* ajout de la fonctionnalité d'importation et d'exportation avec chiffrement des mots de passe ([4f63c4c](https://github.com/TabarBaptiste/dao-generation/commit/4f63c4c2953a49ed321d4bec82236bdad97edb44))

# 1.0.0 (2025-09-04)


### Bug Fixes

* amélioration de la configuration semantic-release pour les extensions VS Code ([0edf576](https://github.com/TabarBaptiste/dao-generation/commit/0edf576933e9a4f2d58c3c42cb7ca9027a538e8c))


### Features

* Ajout d'un formulaire de connexion avec gestion des ressources locales et amélioration de l'interface utilisateur dans des fichiers html, css, js séparés ([036d79c](https://github.com/TabarBaptiste/dao-generation/commit/036d79cf33c624bfb5df529d5c49f5d1155a0e26))
* Ajout de la gestion des connexions à la base de données et des fonctionnalités de sélection de tables ([c304d57](https://github.com/TabarBaptiste/dao-generation/commit/c304d574685b4f6eff94bed3a2ca82108f359dcc))
* Ajout de la sélection des tables avec gestion des états de chargement et d'erreur dans des fichiers html, css, js séparés ([7d34dc2](https://github.com/TabarBaptiste/dao-generation/commit/7d34dc2ec64bead639b54dc0cfaa0ab96b8dae57))
* Ajout de messages d'information et de gestion des dossiers pour la génération de fichiers DAO (D:\\wamp64\\www par défaut) ([908e49c](https://github.com/TabarBaptiste/dao-generation/commit/908e49c017322e332fa3252644e86f0309199ed0))
* Ajout du service DaoGenerator pour la génération de fichiers DAO et amélioration de la gestion des connexions dans DatabaseService ([c18110e](https://github.com/TabarBaptiste/dao-generation/commit/c18110e5a97b8a9f1a6f2141344f6faba71a487c))
* Refactor and enhance PHP DAO Generator extension ([1f34583](https://github.com/TabarBaptiste/dao-generation/commit/1f34583cc9589335e475cdedf939c9bad1a23aa6))

# Change Log

All notable changes to the "dao-generation" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Initial release
