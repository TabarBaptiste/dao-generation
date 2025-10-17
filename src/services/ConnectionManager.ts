import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import {
    DatabaseServeur,
    ExportData,
    ImportData,
    ServeurForExport,
    ServeurForImport,
    ServeurForStorage
} from '../types/Serveur';
import { EncryptionUtil } from '../utils/EncryptionUtil';
import { ErrorHandler } from '../utils/ErrorHandler';
import { ENCRYPTION } from '../constants/AppConstants';
import { DatabaseService } from './DatabaseService';

export class ServeurManager {
    private static readonly ENCRYPTION_KEY = ENCRYPTION.KEY;
    private serveurs: DatabaseServeur[] = [];
    private globalStoragePath: string;

    constructor(private context: vscode.ExtensionContext, private databaseService: DatabaseService) {
        // Utiliser le répertoire de stockage global de l'extension
        this.globalStoragePath = path.join(context.globalStorageUri.fsPath, 'serveurs.json');
        this.loadServeurs();
    }

    /**
     * Retourne la liste complète de tous les serveurs de base de données configurés.
     * Cette méthode fournit un accès en lecture seule à tous les serveurs stockés,
     * incluant leurs informations de connexion et leur état actuel.
     *
     * @return {DatabaseServeur[]} Tableau complet de tous les serveurs configurés avec leurs métadonnées complètes
     * @memberof ServeurManager
     */
    public getServeurs(): DatabaseServeur[] {
        return this.serveurs;
    }

    /**
     * Ajoute un nouveau serveur de base de données après validation et test de connexion.
     * Cette méthode teste automatiquement la connexion, vérifie l'absence de doublon,
     * génère un ID unique et sauvegarde la configuration de façon persistante.
     *
     * @param {Omit<DatabaseServeur, 'id'>} serveurs Configuration complète du nouveau serveur sans l'ID (généré automatiquement)
     * @return {Promise<boolean>} Promesse qui retourne true si le serveur a été ajouté avec succès, false si c'est un doublon existant
     * @memberof ServeurManager
     */
    public async addServeur(serveurs: Omit<DatabaseServeur, 'id'>): Promise<boolean> {
        console.log('dao serveurs :', serveurs);
        const testResult = await this.databaseService.testConnection(serveurs);
        // Créer le serveur finale avec le statut de connexion basé sur le test
        const newServeur: DatabaseServeur = {
            ...serveurs,
            id: this.generateId(),
            isConnected: testResult.success,
            // Ne sauvegarder le defaultDaoPath que si une database est définie
            defaultDaoPath: serveurs.database ? serveurs.defaultDaoPath : undefined
        };

        // Vérifier s'il existe déjà un serveur identique
        const existingServeur = this.serveurs.find(serv => this.isSameServeur(serv, newServeur));

        if (existingServeur) {
            return false; // Serveur en doublon
        }

        this.serveurs.push(newServeur);
        await this.saveServeurs();

        // Afficher un message informatif selon le résultat du test
        if (!testResult.success) {
            vscode.window.showWarningMessage(
                `Serveur "${newServeur.name}" ajouté mais le test a échoué : ${testResult.message} `
            );
        }

        return true;
    }

    /**
     * Met à jour les informations d'un serveur existant avec de nouvelles valeurs.
     * Cette méthode effectue une mise à jour partielle en fusionnant les nouvelles données
     * avec les données existantes, puis sauvegarde automatiquement les modifications.
     *
     * @param {string} id Identifiant unique du serveur à mettre à jour
     * @param {Partial<DatabaseServeur>} serveurs Objet contenant uniquement les propriétés à modifier (mise à jour partielle)
     * @return Promesse qui se résout une fois la mise à jour et la sauvegarde terminées
     * @memberof ServeurManager
     */
    public async updateServeur(id: string, serveurs: Partial<DatabaseServeur>): Promise<void> {
        const index = this.serveurs.findIndex(serv => serv.id === id);
        if (index !== -1) {
            // Nettoyer le defaultDaoPath si pas de database
            const updatedServeur = { ...this.serveurs[index], ...serveurs };
            if (!updatedServeur.database) {
                updatedServeur.defaultDaoPath = undefined;
            }
            this.serveurs[index] = updatedServeur;
            await this.saveServeurs();
        }
    }

    /**
     * Supprime définitivement un serveur de la liste et de la sauvegarde persistante.
     * Cette action est irréversible et supprime toutes les informations de serveur
     * associées au serveur spécifié.
     *
     * @param {string} id Identifiant unique du serveur à supprimer de façon permanente
     * @return Promesse qui se résout une fois la suppression et la sauvegarde terminées
     * @memberof ServeurManager
     */
    public async deleteServeur(id: string): Promise<void> {
        this.serveurs = this.serveurs.filter(serv => serv.id !== id);
        await this.saveServeurs();
    }

    /**
     * Vérifie si un mot de passe est considéré comme valide selon les critères de sécurité.
     * Un mot de passe valide ne doit pas être null, undefined ou une chaîne vide/espaces.
     * Cette validation est utilisée avant le chiffrement et la sauvegarde.
     *
     * @private
     * @param {string} [password] Mot de passe à valider (peut être undefined ou null)
     * @return {boolean} true si le mot de passe est valide (non vide et défini), false sinon
     * @memberof ServeurManager
     */
    private isValidPassword(password?: string): boolean {
        return password !== undefined && password !== null && password.trim().length > 0;
    }

    /**
     * Nettoie et prépare un objet serveur pour la sauvegarde ou l'export en supprimant les propriétés temporaires.
     * Cette méthode élimine les données runtime qui ne doivent pas être persistées
     * et adapte le format selon le contexte (sauvegarde locale vs export).
     *
     * @private
     * @param {DatabaseServeur} serv Objet serveur complet à nettoyer
     * @param {boolean} [includeRuntimeProps=false] Si true, conserve les propriétés runtime comme isConnected (par défaut false)
     * @param {boolean} [forExport=false] Si true, prépare pour export externe en supprimant l'état de connexion (par défaut false)
     * @return {ServeurForStorage | ServeurForExport} Objet serveur nettoyé prêt pour la sauvegarde ou l'export
     * @memberof ServeurManager
     */
    private cleanServeurForStorage(serv: DatabaseServeur, includeRuntimeProps = false, forExport = false): ServeurForStorage | ServeurForExport {
        const cleaned = { ...serv };

        if (!includeRuntimeProps) {
            // Pour l'export, on supprime l'état de connexion
            // Pour la sauvegarde locale, on garde l'état de connexion
            if (forExport) {
                delete cleaned.isConnected;
                delete cleaned.lastConnected;
            }
        }

        return cleaned;
    }

    /**
     * Chiffre de façon sécurisée le mot de passe d'un serveur pour la sauvegarde ou l'export.
     * Cette méthode utilise un chiffrement AES avec clé maître et gère automatiquement
     * les cas d'échec en supprimant le mot de passe plutôt qu'en le stockant en clair.
     *
     * @private
     * @param {DatabaseServeur} serv Serveur dont le mot de passe doit être chiffré
     * @param {string} masterKey Clé maître utilisée pour le chiffrement AES
     * @param {boolean} [forExport=false] Si true, formate pour export (password chiffré), si false pour sauvegarde locale (encryptedPassword)
     * @return {ServeurForStorage | ServeurForExport} Objet serveur avec mot de passe chiffré ou sans mot de passe si chiffrement impossible
     * @memberof ServeurManager
     */
    private encryptServeurPassword(
        serv: DatabaseServeur,
        masterKey: string,
        forExport: boolean = false
    ): ServeurForStorage | ServeurForExport {
        const cleanServ = this.cleanServeurForStorage(serv, false, forExport) as any;

        // Si pas de mot de passe valide, retourner sans chiffrement
        if (!this.isValidPassword(serv.password)) {
            const { password, encryptedPassword, passwordIv, ...servWithoutPassword } = cleanServ;
            return servWithoutPassword;
        }

        // Tenter le chiffrement
        const encrypted = EncryptionUtil.safeEncrypt(serv.password!, masterKey);
        if (!encrypted) {
            ErrorHandler.logError(
                'chiffrement serveur',
                `Échec du chiffrement du mot de passe pour le serveur : ${serv.name}`
            );
            const { password, encryptedPassword, passwordIv, ...servWithoutPassword } = cleanServ;
            return servWithoutPassword;
        }

        // Retourner avec mot de passe chiffré
        const { password, ...servWithoutClearPassword } = cleanServ;
        return forExport
            ? {
                ...servWithoutClearPassword,
                password: encrypted.encrypted,
                passwordIv: encrypted.iv
            }
            : {
                ...servWithoutClearPassword,
                encryptedPassword: encrypted.encrypted,
                passwordIv: encrypted.iv
            };
    }

    /**
     * Charge de façon asynchrone tous les serveurs depuis le stockage persistant de l'extension.
     * Cette méthode crée le répertoire de stockage si nécessaire, déchiffre automatiquement
     * les mots de passe et gère la rétrocompatibilité avec les anciens formats.
     *
     * @private
     * @return Promesse qui se résout une fois tous les serveurs chargés et déchiffrés avec succès
     * @memberof ServeurManager
     */
    private async loadServeurs(): Promise<void> {
        await ErrorHandler.handleAsync(
            'chargement des serveurs',
            async () => {
                // S'assurer que le répertoire existe
                if (!fs.existsSync(path.dirname(this.globalStoragePath))) {
                    fs.mkdirSync(path.dirname(this.globalStoragePath), { recursive: true });
                }

                if (!fs.existsSync(this.globalStoragePath)) {
                    this.serveurs = [];
                    return;
                }

                const fileContent = fs.readFileSync(this.globalStoragePath, 'utf-8');
                const stored = JSON.parse(fileContent);
                // console.log('dao stored (stockage global):', stored);

                if (!stored || !Array.isArray(stored)) {
                    this.serveurs = [];
                    return;
                }

                this.serveurs = stored.map(serv => {
                    // Si le serveur a des données de chiffrement, déchiffrer le mot de passe
                    if (serv.encryptedPassword && serv.passwordIv) {
                        const decryptedPassword = EncryptionUtil.safeDecrypt(
                            serv.encryptedPassword,
                            serv.passwordIv,
                            ServeurManager.ENCRYPTION_KEY
                        );

                        if (decryptedPassword === null) {
                            // Retourner le serveur sans mot de passe en cas d'échec
                            // Note: L'erreur est déjà loguée par safeDecrypt via ErrorHandler.handleSync
                            const { encryptedPassword, passwordIv, ...cleanServ } = serv;
                            return { ...cleanServ, password: '' };
                        }

                        // Retourner le serveur avec le mot de passe déchiffré
                        const { encryptedPassword, passwordIv, ...cleanServ } = serv;
                        return { ...cleanServ, password: decryptedPassword };
                    }

                    // Serveur non chiffrée (rétrocompatibilité)
                    return serv;
                });
            },
            false // Ne pas afficher d'erreur à l'utilisateur, juste initialiser à vide
        );

        // S'assurer qu'on a toujours un tableau même en cas d'erreur
        if (!this.serveurs) {
            this.serveurs = [];
        }
    }

    /**
     * Sauvegarde de façon persistante tous les serveurs dans le stockage global de l'extension.
     * Cette méthode chiffre automatiquement tous les mots de passe avant la sauvegarde
     * et crée le répertoire de stockage si nécessaire.
     *
     * @private
     * @return Promesse qui se résout une fois la sauvegarde chiffrée terminée avec succès
     * @memberof ServeurManager
     */
    private async saveServeurs(): Promise<void> {
        await ErrorHandler.handleAsync(
            'sauvegarde des serveurs',
            async () => {
                const serveursToSave = this.serveurs.map(serv =>
                    this.encryptServeurPassword(serv, ServeurManager.ENCRYPTION_KEY, false)
                );

                // S'assurer que le répertoire existe
                if (!fs.existsSync(path.dirname(this.globalStoragePath))) {
                    fs.mkdirSync(path.dirname(this.globalStoragePath), { recursive: true });
                }

                fs.writeFileSync(this.globalStoragePath, JSON.stringify(serveursToSave, null, 2), 'utf-8');
            }
        );
    }

    /**
     * Génère un identifiant unique et sécurisé pour un nouveau serveur.
     * L'ID combine un timestamp précis et une chaîne aléatoire pour garantir
     * l'unicité même en cas de créations simultanées.
     *
     * @private
     * @return {string} Identifiant unique au format "serv_[timestamp]_[chaîne_aléatoire]"
     * @memberof ServeurManager
     */
    private generateId(): string {
        return `serv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Compare deux serveurs pour déterminer s'ils représentent le même serveur de base de données.
     * La comparaison se base sur l'host, le port, l'utilisateur, le type de serveur et la base de données.
     * Cette méthode est utilisée pour éviter les doublons lors des ajouts.
     *
     * @private
     * @param {DatabaseServeur} serv1 Premier serveur à comparer
     * @param {DatabaseServeur} serv2 Second serveur à comparer
     * @return {boolean} true si les serveurs pointent vers la même base de données, false sinon
     * @memberof ServeurManager
     */
    private isSameServeur(serv1: DatabaseServeur, serv2: DatabaseServeur): boolean {
        // Normaliser les valeurs de base de données
        const db1 = serv1.database || undefined;
        const db2 = serv2.database || undefined;

        return serv1.host === serv2.host &&
            serv1.port === serv2.port &&
            serv1.username === serv2.username &&
            db1 === db2 &&
            serv1.type === serv2.type;
    }

    /**
     * Génère une description textuelle lisible et concise d'un serveur pour l'affichage utilisateur.
     * Le format inclut host:port et optionnellement la base de données si spécifiée.
     * Cette description est utilisée dans les messages d'information et les listes.
     *
     * @param {(DatabaseServeur | Omit<DatabaseServeur, 'id'>)} serveurs Serveur dont générer la description (avec ou sans ID)
     * @return {string} Description formatée du type "host:port" ou "host:port/database"
     * @memberof ServeurManager
     */
    public getServeurDescription(serveurs: DatabaseServeur | Omit<DatabaseServeur, 'id'>): string {
        const database = serveurs.database || undefined;
        return database
            ? `${serveurs.host}:${serveurs.port}/${database}`
            : `${serveurs.host}:${serveurs.port}`;
    }

    /**
     * Compte le nombre de serveurs dans une liste qui possèdent des mots de passe valides.
     * Cette statistique est utilisée pour déterminer les options de chiffrement
     * lors de l'export et informer l'utilisateur des risques de sécurité.
     *
     * @private
     * @param {DatabaseServeur[]} serveurs Tableau de serveurs à analyser
     * @return {number} Nombre total de serveurs ayant un mot de passe non vide et valide
     * @memberof ServeurManager
     */
    private countServeursWithPasswords(serveurs: DatabaseServeur[]): number {
        return serveurs.filter(serv => this.isValidPassword(serv.password)).length;
    }

    /**
     * Présente à l'utilisateur les options de chiffrement lors de l'export de serveurs avec mots de passe.
     * Cette méthode interactive propose soit le chiffrement avec mot de passe maître,
     * soit l'export en texte clair avec avertissement de sécurité explicite.
     *
     * @private
     * @param {number} passwordCount Nombre de serveurs possédant des mots de passe (affiché dans l'invite)
     * @return {Promise<{ useEncryption: boolean; password?: string }>} Promesse retournant la stratégie choisie et le mot de passe maître si applicable
     * @memberof ServeurManager
     */
    private async askEncryptionChoice(passwordCount: number): Promise<{ useEncryption: boolean; password?: string }> {
        const encryptChoice = await vscode.window.showQuickPick([
            {
                label: 'Oui, chiffrer les mots de passe',
                description: 'Protéger les mots de passe avec un mot de passe maître',
                value: 'encrypt'
            },
            {
                label: 'Non, exporter en clair',
                description: 'Les mots de passe seront visibles dans le fichier JSON',
                value: 'plain'
            }
        ], {
            placeHolder: `${passwordCount} serveurs(s) ont des mots de passe. Souhaitez-vous les chiffrer ?`
        });

        if (!encryptChoice) {
            throw new Error('Export annulé par l\'utilisateur');
        }

        if (encryptChoice.value === 'plain') {
            // Confirmer l'export en clair
            const confirmPlain = await vscode.window.showWarningMessage(
                `ATTENTION : Les mots de passe seront exportés en texte clair dans le fichier JSON.\n\nCela représente un risque de sécurité. Êtes-vous sûr de vouloir continuer ?`,
                { modal: true },
                'Oui, exporter en clair'
            );

            if (confirmPlain !== 'Oui, exporter en clair') {
                throw new Error('Export annulé par l\'utilisateur');
            }

            return { useEncryption: false };
        }

        // Demander le mot de passe maître
        const encryptionPassword = await vscode.window.showInputBox({
            prompt: 'Entrez un mot de passe maître pour chiffrer les mots de passe des serveurs',
            password: true,
            placeHolder: 'Mot de passe maître',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Le mot de passe maître ne peut pas être vide';
                }
                if (value.length < 4) {
                    return 'Le mot de passe maître doit contenir au moins 4 caractères';
                }
                return undefined;
            }
        });

        if (!encryptionPassword) {
            throw new Error('Export annulé par l\'utilisateur');
        }

        return { useEncryption: true, password: encryptionPassword };
    }

    /**
     * Traite et prépare un serveur individuel pour l'export selon la stratégie de chiffrement choisie.
     * Cette méthode applique le chiffrement ou l'export en clair tout en gérant
     * automatiquement les cas de mots de passe invalides ou d'échec de chiffrement.
     *
     * @private
     * @param {DatabaseServeur} serv Serveur à traiter pour l'export
     * @param {{ useEncryption: boolean; password?: string }} encryptionConfig Configuration de chiffrement incluant la stratégie et le mot de passe maître
     * @return {ServeurForExport} Objet serveur formaté pour l'export (chiffré, en clair, ou sans mot de passe selon les cas)
     * @memberof ServeurManager
     */
    private processServeurForExport(
        serv: DatabaseServeur,
        encryptionConfig: { useEncryption: boolean; password?: string }
    ): ServeurForExport {
        // Si chiffrement demandé avec mot de passe valide
        if (encryptionConfig.useEncryption && encryptionConfig.password) {
            return this.encryptServeurPassword(serv, encryptionConfig.password, true) as ServeurForExport;
        }

        // Export en clair
        const cleanServ = this.cleanServeurForStorage(serv, false, true) as ServeurForExport;

        // Si pas de mot de passe valide, retourner sans le champ password
        if (!this.isValidPassword(serv.password)) {
            const { password, ...servWithoutPassword } = cleanServ;
            return servWithoutPassword as ServeurForExport;
        }

        return cleanServ;
    }

    /**
     * Orchestre l'export complet des serveurs vers un fichier JSON externe avec gestion du chiffrement.
     * Cette méthode guide l'utilisateur à travers le choix de chiffrement, traite tous les serveurs,
     * et sauvegarde le fichier avec un résumé détaillé de l'opération.
     *
     * @return Promesse qui se résout une fois l'export terminé ou annulé par l'utilisateur
     * @memberof ServeurManager
     */
    public async exportServeurs(): Promise<void> {
        try {
            if (this.serveurs.length === 0) {
                vscode.window.showInformationMessage('Aucun serveur à exporter.');
                return;
            }

            // Compter les serveurs avec mots de passe
            const passwordCount = this.countServeursWithPasswords(this.serveurs);

            // Déterminer la stratégie de chiffrement
            let encryptionConfig: { useEncryption: boolean; password?: string };
            if (passwordCount === 0) {
                encryptionConfig = { useEncryption: false };
            } else {
                encryptionConfig = await this.askEncryptionChoice(passwordCount);
            }

            // Traiter les serveurs pour l'export
            const processedServeurs = this.serveurs.map(serv =>
                this.processServeurForExport(serv, encryptionConfig)
            );

            // Vérifier s'il y a vraiment du chiffrement
            const hasEncryptedData = processedServeurs.some(serv => serv.passwordIv);

            // Créer les données d'export
            const exportData: ExportData = {
                exportDate: new Date().toISOString(),
                encrypted: hasEncryptedData,
                serveurs: processedServeurs
            };

            // Sauvegarder le fichier
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('php-dao-serveurs.json'),
                filters: {
                    'Fichiers JSON': ['json'],
                    'Tous les fichiers': ['*']
                },
                saveLabel: 'Exporter les serveurs'
            });

            if (!saveUri) {
                return;
            }

            const jsonContent = JSON.stringify(exportData, null, 2);
            await vscode.workspace.fs.writeFile(saveUri, Buffer.from(jsonContent, 'utf8'));

            // Message de succès
            let message = `${this.serveurs.length} serveur(s) exportée(s) avec succès vers ${saveUri.fsPath}`;
            if (hasEncryptedData) {
                message += ` (${passwordCount} mots de passe chiffrés)`;
            } else if (passwordCount > 0) {
                message += ` (${passwordCount} mots de passe en texte clair)`;
            } else {
                message += ` (aucun mot de passe à protéger)`;
            }

            vscode.window.showInformationMessage(message);
        } catch (error) {
            if (error instanceof Error && error.message.includes('annulé par l\'utilisateur')) {
                return; // Ne pas afficher d'erreur si l'utilisateur a annulé
            }
            ErrorHandler.logError('exportation serveurs', error);
            ErrorHandler.showError('exportation serveurs', error);
        }
    }

    /**
     * Valide la structure et les champs obligatoires d'un serveur importé depuis un fichier externe.
     * Cette validation vérifie la présence des champs essentiels et la compatibilité
     * du type de serveur avec les systèmes supportés (MySQL/MariaDB).
     *
     * @private
     * @param {ServeurForImport} serv Objet serveur à valider depuis fichier JSON externe
     * @return {boolean} true si la structure est valide et complète, false si des champs essentiels manquent
     * @memberof ServeurManager
     */
    private validateImportedServeur(serv: ServeurForImport): boolean {
        return !!(serv.name && serv.host && serv.port && serv.username &&
            serv.type && ['mysql', 'mariadb'].includes(serv.type));
    }

    /**
     * Traite un serveur importé en gérant le déchiffrement automatique des mots de passe si nécessaire.
     * Cette méthode valide la structure, déchiffre les mots de passe chiffrés avec le mot de passe maître,
     * et nettoie les données pour l'intégration dans le système local.
     *
     * @private
     * @param {ServeurForImport} serv Serveur brut importé depuis fichier JSON
     * @param {string} [decryptionPassword] Mot de passe maître pour déchiffrer les mots de passe chiffrés (optionnel si non chiffré)
     * @return {Omit<DatabaseServeur, 'id' | 'isConnected' | 'lastConnected'>} Serveur traité et nettoyé prêt pour intégration locale
     * @memberof ServeurManager
     */
    private processImportedServeur(serv: ServeurForImport, decryptionPassword?: string): Omit<DatabaseServeur, 'id' | 'isConnected' | 'lastConnected'> {
        // Validation de base
        if (!this.validateImportedServeur(serv)) {
            throw new Error(`Serveur invalide : ${serv.name || 'sans nom'}`);
        }

        // Gestion du déchiffrement
        if (serv.passwordIv && serv.password && decryptionPassword) {
            const decryptedPassword = EncryptionUtil.safeDecrypt(serv.password, serv.passwordIv, decryptionPassword);
            if (decryptedPassword === null) {
                throw new Error(`Mot de passe incorrect pour : ${serv.name}`);
            }

            const { passwordIv, ...cleanServ } = serv;
            return { ...cleanServ, password: decryptedPassword };
        }

        // Serveur non chiffrée ou sans mot de passe
        const { passwordIv, ...cleanServ } = serv;
        return { ...cleanServ, password: serv.password || '' };
    }

    /**
     * Orchestre l'import complet de serveurs depuis un fichier JSON externe avec gestion du déchiffrement.
     * Cette méthode guide l'utilisateur dans la sélection du fichier, gère les mots de passe chiffrés,
     * et importe uniquement les nouveaux serveurs en évitant les doublons.
     *
     * @return Promesse qui se résout une fois l'import terminé avec un résumé des opérations effectuées
     * @memberof ServeurManager
     */
    public async importServeurs(): Promise<void> {
        await ErrorHandler.handleAsync(
            'importation serveurs',
            async () => {
                // Ouvrir le fichier
                const openUri = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectMany: false,
                    filters: {
                        'Fichiers JSON': ['json'],
                        'Tous les fichiers': ['*']
                    },
                    openLabel: 'Importer les serveurs'
                });

                if (!openUri || openUri.length === 0) {
                    return;
                }

                // Lire et parser le fichier
                const fileUri = openUri[0];
                const fileContent = await vscode.workspace.fs.readFile(fileUri);
                const jsonContent = Buffer.from(fileContent).toString('utf8');

                let importData: ImportData;
                try {
                    importData = JSON.parse(jsonContent) as ImportData;
                } catch (parseError) {
                    throw new Error('Format de fichier JSON invalide');
                }

                if (!importData.serveurs || !Array.isArray(importData.serveurs)) {
                    throw new Error('Format de fichier invalide : tableau de serveurs manquant');
                }

                // Gestion du déchiffrement
                const isEncrypted = importData.encrypted === true;
                const hasEncryptedPasswords = importData.serveurs.some((serv: ServeurForImport) => serv.passwordIv);

                let decryptionPassword: string | undefined;

                if (isEncrypted && hasEncryptedPasswords) {
                    decryptionPassword = await vscode.window.showInputBox({
                        prompt: 'Ce fichier contient des mots de passe chiffrés. Entrez le mot de passe maître pour les déchiffrer :',
                        password: true,
                        placeHolder: 'Mot de passe maître',
                        validateInput: (value) => {
                            if (!value || value.trim().length === 0) {
                                return 'Le mot de passe maître ne peut pas être vide';
                            }
                            return undefined;
                        }
                    });

                    if (!decryptionPassword) {
                        vscode.window.showWarningMessage('Importation annulée : un mot de passe maître est requis pour déchiffrer les fichiers chiffrés.');
                        return;
                    }
                }

                // Traiter les serveurs
                const validServeurs: DatabaseServeur[] = [];
                const errors: string[] = [];

                for (const serv of importData.serveurs) {
                    try {
                        const processedServ = this.processImportedServeur(serv, decryptionPassword);
                        validServeurs.push({
                            ...processedServ,
                            id: this.generateId(),
                            isConnected: false,
                            lastConnected: undefined
                        });
                    } catch (error) {
                        errors.push(error instanceof Error ? error.message : 'Erreur inconnue');
                    }
                }

                if (validServeurs.length === 0) {
                    throw new Error(`Aucun serveur valide trouvé (${errors.length} erreur${errors.length > 1 ? 's' : ''})`);
                }

                // Importer uniquement les nouveaux serveurs
                let addedCount = 0;
                let skippedCount = 0;

                for (const importedServ of validServeurs) {
                    const existingIndex = this.serveurs.findIndex(s => this.isSameServeur(s, importedServ));

                    if (existingIndex === -1) {
                        // Nouveau serveur : l'ajouter
                        this.serveurs.push(importedServ);
                        addedCount++;
                    } else {
                        // Serveur existant : l'ignorer
                        skippedCount++;
                    }
                }

                await this.saveServeurs();

                // Message de succès
                let message = `Import réussi : ${addedCount} serveur${addedCount > 1 ? 's' : ''} ajouté${addedCount > 1 ? 's' : ''}`;
                if (skippedCount > 0) { message += `, ${skippedCount} ignoré${skippedCount > 1 ? 's' : ''} (déjà existant${skippedCount > 1 ? 's' : ''})`; }
                if (hasEncryptedPasswords && decryptionPassword) { message += ` | Mots de passe déchiffrés`; }
                else if (!isEncrypted) { message += ` | Fichier non chiffré`; }

                if (errors.length > 0) {
                    // Afficher le message de succès avec option de voir les erreurs
                    const action = await vscode.window.showInformationMessage(
                        `${message} (${errors.length} serveur${errors.length > 1 ? 's' : ''} ignoré${errors.length > 1 ? 's' : ''})`,
                        'Afficher les détails'
                    );
                    if (action === 'Afficher les détails') {
                        vscode.window.showErrorMessage(`Serveurs non importés :\n${errors.join('\n')}`);
                    }
                } else {
                    vscode.window.showInformationMessage(message);
                }
            }
        );
    }
}