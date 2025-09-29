import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseServeur } from '../types/Connection';
import { EncryptionUtil } from '../utils/EncryptionUtil';
import { ErrorHandler } from '../utils/ErrorHandler';
import { STORAGE_KEYS, ENCRYPTION } from '../constants/AppConstants';
import { DatabaseService } from './DatabaseService';

export class ServeurManager {
    private static readonly STORAGE_KEY = STORAGE_KEYS.CONNECTIONS;
    private static readonly ENCRYPTION_KEY = ENCRYPTION.KEY;
    private serveurs: DatabaseServeur[] = [];
    private globalStoragePath: string;

    constructor(private context: vscode.ExtensionContext, private databaseService: DatabaseService) {
        // Utiliser le répertoire de stockage global de l'extension
        this.globalStoragePath = path.join(context.globalStorageUri.fsPath, 'serveurs.json');
        console.log('this.globalStoragePath :', this.globalStoragePath);
        this.loadServeurs();
    }

    public getServeurs(): DatabaseServeur[] {
        return this.serveurs;
    }

    public async addServeur(serveurs: Omit<DatabaseServeur, 'id'>): Promise<boolean> {
        const testResult = await this.databaseService.testConnection(serveurs);
        // Créer le serveur finale avec le statut de connexion basé sur le test
        const newServeur: DatabaseServeur = {
            ...serveurs,
            id: this.generateId(),
            isConnected: testResult.success,
            // Ne sauvegarder le defaultDaoPath que si une database est définie
            defaultDaoPath: serveurs.database ? serveurs.defaultDaoPath : undefined
        };

        // Vérifier s'il existe déjà une connexion identique
        const existingServeur = this.serveurs.find(conn => this.isSameServeur(conn, newServeur));

        if (existingServeur) {
            return false; // Serveur en doublon
        }

        this.serveurs.push(newServeur);
        await this.saveServeurs();

        // Afficher un message informatif selon le résultat du test
        if (!testResult.success) {
            vscode.window.showWarningMessage(
                `Connexion "${newServeur.name}" ajouté mais le test a échoué : ${testResult.message} `
            );
        }

        return true;
    }

    public async updateServeur(id: string, serveurs: Partial<DatabaseServeur>): Promise<void> {
        const index = this.serveurs.findIndex(conn => conn.id === id);
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

    public async deleteServeur(id: string): Promise<void> {
        this.serveurs = this.serveurs.filter(conn => conn.id !== id);
        await this.saveServeurs();
    }

    public getServeurById(id: string): DatabaseServeur | undefined {
        return this.serveurs.find(conn => conn.id === id);
    }

    /**
     * Vérifie si un mot de passe est valide (non vide et non null/undefined)
     */
    private isValidPassword(password?: string): boolean {
        return password !== undefined && password !== null && password.trim().length > 0;
    }

    /**
     * Nettoie une connexion pour la sauvegarde/export en supprimant les propriétés temporaires
     */
    private cleanServeurForStorage(conn: DatabaseServeur, includeRuntimeProps = false, forExport = false): any {
        const cleaned = { ...conn };

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

    private async loadServeurs(): Promise<void> {
        await ErrorHandler.handleAsync(
            'chargement des connexions',
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
                console.log('dao stored (stockage global):', stored);

                if (!stored || !Array.isArray(stored)) {
                    this.serveurs = [];
                    return;
                }

                this.serveurs = stored.map(conn => {
                    // Si le serveur a des données de chiffrement, déchiffrer le mot de passe
                    if (conn.encryptedPassword && conn.passwordIv) {
                        const decryptedPassword = EncryptionUtil.safeDecrypt(
                            conn.encryptedPassword,
                            conn.passwordIv,
                            ServeurManager.ENCRYPTION_KEY
                        );

                        if (decryptedPassword === null) {
                            ErrorHandler.logError('déchiffrement serveur', `Échec du déchiffrement du mot de passe pour le serveur : ${conn.name}`);
                            // Retourner le serveur sans mot de passe en cas d'échec
                            const { encryptedPassword, passwordIv, ...cleanConn } = conn;
                            return { ...cleanConn, password: '' };
                        }

                        // Retourner le serveur avec le mot de passe déchiffré
                        const { encryptedPassword, passwordIv, ...cleanConn } = conn;
                        return { ...cleanConn, password: decryptedPassword };
                    }

                    // Connexion non chiffrée (rétrocompatibilité)
                    return conn;
                });
            },
            false // Ne pas afficher d'erreur à l'utilisateur, juste initialiser à vide
        );

        // S'assurer qu'on a toujours un tableau même en cas d'erreur
        if (!this.serveurs) {
            this.serveurs = [];
        }
    }

    private async saveServeurs(): Promise<void> {
        await ErrorHandler.handleAsync(
            'sauvegarde des connexions',
            async () => {
                const connectionsToSave = this.serveurs.map(conn => {
                    // Garder l'état de connexion pour la sauvegarde locale (forExport = false)
                    const cleanConn = this.cleanServeurForStorage(conn, false, false);

                    // Si pas de mot de passe valide, sauvegarder sans chiffrement
                    if (!this.isValidPassword(conn.password)) {
                        const { password, encryptedPassword, passwordIv, ...connWithoutPassword } = cleanConn;
                        return connWithoutPassword;
                    }

                    // Chiffrer le mot de passe
                    const encrypted = EncryptionUtil.safeEncrypt(conn.password!, ServeurManager.ENCRYPTION_KEY);
                    if (!encrypted) {
                        ErrorHandler.logError('chiffrement connexion', `Échec du chiffrement du mot de passe pour le serveur : ${conn.name}`);
                        const { password, encryptedPassword, passwordIv, ...connWithoutPassword } = cleanConn;
                        return connWithoutPassword;
                    }

                    const { password, ...connWithoutClearPassword } = cleanConn;
                    return {
                        ...connWithoutClearPassword,
                        encryptedPassword: encrypted.encrypted,
                        passwordIv: encrypted.iv
                    };
                });

                // S'assurer que le répertoire existe
                if (!fs.existsSync(path.dirname(this.globalStoragePath))) {
                    fs.mkdirSync(path.dirname(this.globalStoragePath), { recursive: true });
                }

                fs.writeFileSync(this.globalStoragePath, JSON.stringify(connectionsToSave, null, 2), 'utf-8');
            }
        );
    }

    private generateId(): string {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Vérifie si deux connexions sont identiques (même serveur, même base de données)
     */
    private isSameServeur(conn1: DatabaseServeur, conn2: DatabaseServeur): boolean {
        // TODO : vérifier aussi avec "name"
        // Normaliser les valeurs de base de données
        const db1 = conn1.database || undefined;
        const db2 = conn2.database || undefined;

        return conn1.host === conn2.host &&
            conn1.port === conn2.port &&
            conn1.username === conn2.username &&
            db1 === db2 &&
            conn1.type === conn2.type;
    }

    /**
     * Génère une description lisible d'une connexion pour les messages utilisateur
     */
    public getServeurDescription(serveurs: DatabaseServeur | Omit<DatabaseServeur, 'id'>): string {
        const database = serveurs.database || undefined;
        return database
            ? `${serveurs.host}:${serveurs.port}/${database}`
            : `${serveurs.host}:${serveurs.port}`;
    }

    /**
     * Compte le nombre de connexions avec des mots de passe valides
     */
    private countServeursWithPasswords(serveurs: any[]): number {
        return serveurs.filter(conn => this.isValidPassword(conn.password)).length;
    }

    /**
     * Demande à l'utilisateur s'il veut chiffrer les mots de passe lors de l'export
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
            prompt: 'Entrez un mot de passe maître pour chiffrer les mots de passe des connexions',
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
     * Traite une connexion pour l'export (chiffrement ou nettoyage)
     */
    private processServeurForExport(conn: DatabaseServeur, encryptionConfig: { useEncryption: boolean; password?: string }): any {
        // Pour l'export, supprimer l'état de connexion (forExport = true)
        const cleanConn = this.cleanServeurForStorage(conn, false, true);

        // Si pas de mot de passe valide, retourner sans le champ password
        if (!this.isValidPassword(conn.password)) {
            const { password, ...connWithoutPassword } = cleanConn;
            return connWithoutPassword;
        }

        // Si chiffrement demandé
        if (encryptionConfig.useEncryption && encryptionConfig.password) {
            const encrypted = EncryptionUtil.safeEncrypt(conn.password!, encryptionConfig.password);
            if (!encrypted) {
                // TODO "Échec du chiffrement du mot de passe pour le serveur" deux fois. Factoriser !
                ErrorHandler.logError('chiffrement exportation', `Échec du chiffrement du mot de passe pour le serveur : ${conn.name}`);
                const { password, ...connWithoutPassword } = cleanConn;
                return connWithoutPassword;
            }

            return {
                ...cleanConn,
                password: encrypted.encrypted,
                passwordIv: encrypted.iv
            };
        }

        // Export en clair
        return cleanConn;
    }

    public async exportServeurs(): Promise<void> {
        try {
            if (this.serveurs.length === 0) {
                vscode.window.showInformationMessage('Aucun serveur à exporter.');
                return;
            }

            // Compter les connexions avec mots de passe
            const passwordCount = this.countServeursWithPasswords(this.serveurs);

            // Déterminer la stratégie de chiffrement
            let encryptionConfig: { useEncryption: boolean; password?: string };
            if (passwordCount === 0) {
                encryptionConfig = { useEncryption: false };
            } else {
                encryptionConfig = await this.askEncryptionChoice(passwordCount);
            }

            // Traiter les connexions pour l'export
            const processedServeurs = this.serveurs.map(conn =>
                this.processServeurForExport(conn, encryptionConfig)
            );

            // Vérifier s'il y a vraiment du chiffrement
            const hasEncryptedData = processedServeurs.some(conn => conn.passwordIv);

            // Créer les données d'export
            const exportData = {
                exportDate: new Date().toISOString(),
                // version: '1.0.0',
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
                saveLabel: 'Exporter les connexions'
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
            ErrorHandler.logError('exportation connexions', error);
            ErrorHandler.showError('exportation connexions', error);
        }
    }

    /**
     * Valide la structure d'une connexion importée
     */
    private validateImportedServeur(conn: any): boolean {
        return !!(conn.name && conn.host && conn.port && conn.username &&
            conn.type && ['mysql', 'mariadb'].includes(conn.type));
    }

    /**
     * Traite une connexion importée (déchiffrement si nécessaire)
     */
    private processImportedServeur(conn: any, decryptionPassword?: string): any {
        // Validation de base
        if (!this.validateImportedServeur(conn)) {
            throw new Error(`Format de connexion invalide : ${conn.name || 'sans nom'}`);
        }

        // Gestion du déchiffrement
        if (conn.passwordIv && decryptionPassword) {
            const decryptedPassword = EncryptionUtil.safeDecrypt(conn.password, conn.passwordIv, decryptionPassword);
            if (decryptedPassword === null) {
                throw new Error(`Échec du déchiffrement du mot de passe pour le serveur : ${conn.name}`);
            }

            const { passwordIv, ...cleanConn } = conn;
            return { ...cleanConn, password: decryptedPassword };
        }

        // Connexion non chiffrée ou sans mot de passe
        const { passwordIv, ...cleanConn } = conn;
        return { ...cleanConn, password: conn.password || '' };
    }

    /**
     * Gère l'import d'une connexion (ajout/mise à jour)
     */
    private async handleServeurImport(
        importedConn: DatabaseServeur,
        autoUpdate: boolean
    ): Promise<{ action: 'added' | 'updated' | 'skipped'; autoUpdate: boolean }> {
        const existingIndex = this.serveurs.findIndex(conn =>
            this.isSameServeur(conn, importedConn)
        );

        if (existingIndex === -1) {
            // Nouvelle connexion
            this.serveurs.push(importedConn);
            return { action: 'added', autoUpdate };
        }

        // Connexion existante
        if (!autoUpdate) {
            const updateChoice = await vscode.window.showQuickPick([
                { label: 'Oui', description: 'Mettre à jour cette connexion', value: 'yes' },
                { label: 'Non', description: 'Conserver le serveur existante', value: 'no' },
                { label: 'Oui pour tout', description: 'Mettre à jour celle-ci et tous les doublons restants', value: 'yesAll' }
            ], {
                placeHolder: `La connexion "${importedConn.name}" existe déjà. La mettre à jour ?`
            });

            if (!updateChoice) {
                return { action: 'skipped', autoUpdate };
            }

            if (updateChoice.value === 'no') {
                return { action: 'skipped', autoUpdate };
            }

            if (updateChoice.value === 'yesAll') {
                autoUpdate = true;
            }
        }

        // Mettre à jour le serveur en conservant l'ID original
        this.serveurs[existingIndex] = {
            ...importedConn,
            id: this.serveurs[existingIndex].id
        };

        return { action: 'updated', autoUpdate };
    }

    public async importServeurs(): Promise<void> {
        try {
            // Ouvrir le fichier
            const openUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: {
                    'Fichiers JSON': ['json'],
                    'Tous les fichiers': ['*']
                },
                openLabel: 'Importer les connexions'
            });

            if (!openUri || openUri.length === 0) {
                return;
            }

            // Lire et parser le fichier
            const fileUri = openUri[0];
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const jsonContent = Buffer.from(fileContent).toString('utf8');

            let importData: any;
            try {
                importData = JSON.parse(jsonContent);
            } catch (parseError) {
                throw new Error('Format de fichier JSON invalide');
            }

            if (!importData.serveurs || !Array.isArray(importData.serveurs)) {
                throw new Error('Format de fichier invalide : tableau de connexions manquant');
            }

            // Gestion du déchiffrement
            const isEncrypted = importData.encrypted === true;
            const hasEncryptedPasswords = importData.serveurs.some((conn: any) => conn.passwordIv);

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

            // Traiter les connexions
            const validServeurs: DatabaseServeur[] = [];
            const errors: string[] = [];

            for (const conn of importData.serveurs) {
                try {
                    const processedConn = this.processImportedServeur(conn, decryptionPassword);
                    validServeurs.push({
                        ...processedConn,
                        id: this.generateId(),
                        isConnected: false,
                        lastConnected: undefined
                    });
                } catch (error) {
                    errors.push(error instanceof Error ? error.message : 'Erreur inconnue');
                }
            }

            if (validServeurs.length === 0) {
                const errorMessage = errors.length > 0
                    ? `Aucune connexion valide trouvée. Erreurs :\n${errors.join('\n')}`
                    : 'Aucune connexion valide trouvée dans le fichier d\'importation';
                throw new Error(errorMessage);
            }

            // TODO : Modifier pour mettre à jour les connexions existantes et ajouter celles qui n'existe pas encore par défaut.
            // TODO : Donc, Plus besoin de demander si on ajoute ou remplace. (Corriger/Supprimer aussi handleServeurImport())
            // Déterminer le mode d'importation
            let importMode = 'merge';
            if (this.serveurs.length > 0) {
                const choice = await vscode.window.showQuickPick([
                    {
                        label: 'Fusion',
                        description: 'Ajouter de nouvelles connexions et mettre à jour les existantes',
                        value: 'merge'
                    },
                    {
                        label: 'Remplacement',
                        description: 'Remplacer uniquement les connexions importées',
                        value: 'replace'
                    }
                ], {
                    placeHolder: 'Choisir le mode d\'importation'
                });

                if (!choice) {
                    return;
                }

                importMode = choice.value;
            }

            // Importer les connexions
            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            let autoUpdate = false;

            if (importMode === 'replace') {
                // Mode remplacement : traiter toutes les connexions automatiquement
                for (const importedConn of validServeurs) {
                    const result = await this.handleServeurImport(importedConn, true);
                    if (result.action === 'added') addedCount++;
                    else if (result.action === 'updated') updatedCount++;
                }
            } else {
                // Mode fusion : demander confirmation pour les doublons
                for (const importedConn of validServeurs) {
                    const result = await this.handleServeurImport(importedConn, autoUpdate);
                    autoUpdate = result.autoUpdate;

                    if (result.action === 'added') addedCount++;
                    else if (result.action === 'updated') updatedCount++;
                    else if (result.action === 'skipped') skippedCount++;
                }
            }

            await this.saveServeurs();

            // Message de succès
            let message = `Import réussi : ${addedCount} ajoutées`;
            if (updatedCount > 0) message += `, ${updatedCount} mises à jour`;
            if (skippedCount > 0) message += `, ${skippedCount} ignorées`;
            if (errors.length > 0) message += ` (${errors.length} erreurs)`;
            if (hasEncryptedPasswords && decryptionPassword) message += ` |  Mots de passe déchiffrés`;
            else if (!isEncrypted) message += ` | Fichier non chiffré`;

            vscode.window.showInformationMessage(message);

            // Afficher les erreurs si nécessaire
            if (errors.length > 0 && errors.length < 10) {
                const showErrors = await vscode.window.showWarningMessage(
                    `Certaines connexions n'ont pas pu être importées. Afficher les détails ?`,
                    'Afficher les détails'
                );
                if (showErrors) {
                    vscode.window.showErrorMessage(`Erreurs d'importation :\n${errors.join('\n')}`);
                }
            }
        } catch (error) {
            ErrorHandler.logError('importation connexions', error);
            ErrorHandler.showError('importation connexions', error);
        }
    }
}