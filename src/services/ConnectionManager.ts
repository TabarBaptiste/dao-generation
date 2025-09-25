import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseConnection } from '../types/Connection';
import { EncryptionUtil } from '../utils/EncryptionUtil';
import { ErrorHandler } from '../utils/ErrorHandler';
import { STORAGE_KEYS, ENCRYPTION } from '../constants/AppConstants';
import { DatabaseService } from './DatabaseService';

export class ConnectionManager {
    private static readonly STORAGE_KEY = STORAGE_KEYS.CONNECTIONS;
    private static readonly ENCRYPTION_KEY = ENCRYPTION.KEY;
    private connections: DatabaseConnection[] = [];
    private globalStoragePath: string;

    constructor(private context: vscode.ExtensionContext, private databaseService: DatabaseService) {
        // Utiliser le répertoire de stockage global de l'extension
        this.globalStoragePath = path.join(context.globalStorageUri.fsPath, 'connections.json');
        console.log('this.globalStoragePath :', this.globalStoragePath);
        this.loadConnections();
    }

    public getConnections(): DatabaseConnection[] {
        return this.connections;
    }

    public async addConnection(connection: Omit<DatabaseConnection, 'id'>): Promise<boolean> {
        const testResult = await this.databaseService.testConnection(connection);
        // Créer la connexion finale avec le statut de connexion basé sur le test
        const newConnection: DatabaseConnection = {
            ...connection,
            id: this.generateId(),
            isConnected: testResult.success,
            // Ne sauvegarder le defaultDaoPath que si une database est définie
            defaultDaoPath: connection.database ? connection.defaultDaoPath : undefined
        };

        // Vérifier s'il existe déjà une connexion identique
        const existingConnection = this.connections.find(conn => this.isSameConnection(conn, newConnection));

        if (existingConnection) {
            return false; // Connexion en doublon
        }

        this.connections.push(newConnection);
        await this.saveConnections();

        // Afficher un message informatif selon le résultat du test
        if (!testResult.success) {
            vscode.window.showWarningMessage(
                `Connexion "${newConnection.name}" ajoutée mais le test a échoué : ${testResult.message} `
            );
        }

        return true;
    }

    public async updateConnection(id: string, connection: Partial<DatabaseConnection>): Promise<void> {
        const index = this.connections.findIndex(conn => conn.id === id);
        if (index !== -1) {
            // Nettoyer le defaultDaoPath si pas de database
            const updatedConnection = { ...this.connections[index], ...connection };
            if (!updatedConnection.database) {
                updatedConnection.defaultDaoPath = undefined;
            }
            this.connections[index] = updatedConnection;
            await this.saveConnections();
        }
    }

    public async deleteConnection(id: string): Promise<void> {
        this.connections = this.connections.filter(conn => conn.id !== id);
        await this.saveConnections();
    }

    public getConnectionById(id: string): DatabaseConnection | undefined {
        return this.connections.find(conn => conn.id === id);
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
    private cleanConnectionForStorage(conn: DatabaseConnection, includeRuntimeProps = false, forExport = false): any {
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

    private async loadConnections(): Promise<void> {
        await ErrorHandler.handleAsync(
            'chargement des connexions',
            async () => {
                // S'assurer que le répertoire existe
                if (!fs.existsSync(path.dirname(this.globalStoragePath))) {
                    fs.mkdirSync(path.dirname(this.globalStoragePath), { recursive: true });
                }

                if (!fs.existsSync(this.globalStoragePath)) {
                    this.connections = [];
                    return;
                }

                const fileContent = fs.readFileSync(this.globalStoragePath, 'utf-8');
                const stored = JSON.parse(fileContent);
                console.log('dao stored (stockage global):', stored);

                if (!stored || !Array.isArray(stored)) {
                    this.connections = [];
                    return;
                }

                this.connections = stored.map(conn => {
                    // Si la connexion a des données de chiffrement, déchiffrer le mot de passe
                    if (conn.encryptedPassword && conn.passwordIv) {
                        const decryptedPassword = EncryptionUtil.safeDecrypt(
                            conn.encryptedPassword,
                            conn.passwordIv,
                            ConnectionManager.ENCRYPTION_KEY
                        );

                        if (decryptedPassword === null) {
                            ErrorHandler.logError('déchiffrement connexion', `Échec du déchiffrement du mot de passe pour la connexion : ${conn.name}`);
                            // Retourner la connexion sans mot de passe en cas d'échec
                            const { encryptedPassword, passwordIv, ...cleanConn } = conn;
                            return { ...cleanConn, password: '' };
                        }

                        // Retourner la connexion avec le mot de passe déchiffré
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
        if (!this.connections) {
            this.connections = [];
        }
    }

    private async saveConnections(): Promise<void> {
        await ErrorHandler.handleAsync(
            'sauvegarde des connexions',
            async () => {
                const connectionsToSave = this.connections.map(conn => {
                    // Garder l'état de connexion pour la sauvegarde locale (forExport = false)
                    const cleanConn = this.cleanConnectionForStorage(conn, false, false);

                    // Si pas de mot de passe valide, sauvegarder sans chiffrement
                    if (!this.isValidPassword(conn.password)) {
                        const { password, encryptedPassword, passwordIv, ...connWithoutPassword } = cleanConn;
                        return connWithoutPassword;
                    }

                    // Chiffrer le mot de passe
                    const encrypted = EncryptionUtil.safeEncrypt(conn.password!, ConnectionManager.ENCRYPTION_KEY);
                    if (!encrypted) {
                        ErrorHandler.logError('chiffrement connexion', `Échec du chiffrement du mot de passe pour la connexion : ${conn.name}`);
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
    private isSameConnection(conn1: DatabaseConnection, conn2: DatabaseConnection): boolean {
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
    public getConnectionDescription(connection: DatabaseConnection | Omit<DatabaseConnection, 'id'>): string {
        const database = connection.database || undefined;
        return database
            ? `${connection.host}:${connection.port}/${database}`
            : `${connection.host}:${connection.port}`;
    }

    /**
     * Compte le nombre de connexions avec des mots de passe valides
     */
    private countConnectionsWithPasswords(connections: any[]): number {
        return connections.filter(conn => this.isValidPassword(conn.password)).length;
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
            placeHolder: `${passwordCount} connexion(s) ont des mots de passe. Souhaitez-vous les chiffrer ?`
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
    private processConnectionForExport(conn: DatabaseConnection, encryptionConfig: { useEncryption: boolean; password?: string }): any {
        // Pour l'export, supprimer l'état de connexion (forExport = true)
        const cleanConn = this.cleanConnectionForStorage(conn, false, true);

        // Si pas de mot de passe valide, retourner sans le champ password
        if (!this.isValidPassword(conn.password)) {
            const { password, ...connWithoutPassword } = cleanConn;
            return connWithoutPassword;
        }

        // Si chiffrement demandé
        if (encryptionConfig.useEncryption && encryptionConfig.password) {
            const encrypted = EncryptionUtil.safeEncrypt(conn.password!, encryptionConfig.password);
            if (!encrypted) {
                ErrorHandler.logError('chiffrement exportation', `Échec du chiffrement du mot de passe pour la connexion : ${conn.name}`);
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

    public async exportConnections(): Promise<void> {
        try {
            if (this.connections.length === 0) {
                vscode.window.showInformationMessage('Aucune connexion à exporter.');
                return;
            }

            // Compter les connexions avec mots de passe
            const passwordCount = this.countConnectionsWithPasswords(this.connections);

            // Déterminer la stratégie de chiffrement
            let encryptionConfig: { useEncryption: boolean; password?: string };
            if (passwordCount === 0) {
                encryptionConfig = { useEncryption: false };
            } else {
                encryptionConfig = await this.askEncryptionChoice(passwordCount);
            }

            // Traiter les connexions pour l'export
            const processedConnections = this.connections.map(conn =>
                this.processConnectionForExport(conn, encryptionConfig)
            );

            // Vérifier s'il y a vraiment du chiffrement
            const hasEncryptedData = processedConnections.some(conn => conn.passwordIv);

            // Créer les données d'export
            const exportData = {
                exportDate: new Date().toISOString(),
                // version: '1.0.0',
                encrypted: hasEncryptedData,
                connections: processedConnections
            };

            // Sauvegarder le fichier
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('php-dao-connections.json'),
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
            let message = `${this.connections.length} connexion(s) exportée(s) avec succès vers ${saveUri.fsPath}`;
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
    private validateImportedConnection(conn: any): boolean {
        return !!(conn.name && conn.host && conn.port && conn.username &&
            conn.type && ['mysql', 'mariadb'].includes(conn.type));
    }

    /**
     * Traite une connexion importée (déchiffrement si nécessaire)
     */
    private processImportedConnection(conn: any, decryptionPassword?: string): any {
        // Validation de base
        if (!this.validateImportedConnection(conn)) {
            throw new Error(`Format de connexion invalide : ${conn.name || 'sans nom'}`);
        }

        // Gestion du déchiffrement
        if (conn.passwordIv && decryptionPassword) {
            const decryptedPassword = EncryptionUtil.safeDecrypt(conn.password, conn.passwordIv, decryptionPassword);
            if (decryptedPassword === null) {
                throw new Error(`Échec du déchiffrement du mot de passe pour la connexion : ${conn.name}`);
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
    private async handleConnectionImport(
        importedConn: DatabaseConnection,
        autoUpdate: boolean
    ): Promise<{ action: 'added' | 'updated' | 'skipped'; autoUpdate: boolean }> {
        const existingIndex = this.connections.findIndex(conn =>
            this.isSameConnection(conn, importedConn)
        );

        if (existingIndex === -1) {
            // Nouvelle connexion
            this.connections.push(importedConn);
            return { action: 'added', autoUpdate };
        }

        // Connexion existante
        if (!autoUpdate) {
            const updateChoice = await vscode.window.showQuickPick([
                { label: 'Oui', description: 'Mettre à jour cette connexion', value: 'yes' },
                { label: 'Non', description: 'Conserver la connexion existante', value: 'no' },
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

        // Mettre à jour la connexion en conservant l'ID original
        this.connections[existingIndex] = {
            ...importedConn,
            id: this.connections[existingIndex].id
        };

        return { action: 'updated', autoUpdate };
    }

    public async importConnections(): Promise<void> {
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

            if (!importData.connections || !Array.isArray(importData.connections)) {
                throw new Error('Format de fichier invalide : tableau de connexions manquant');
            }

            // Gestion du déchiffrement
            const isEncrypted = importData.encrypted === true;
            const hasEncryptedPasswords = importData.connections.some((conn: any) => conn.passwordIv);

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
            const validConnections: DatabaseConnection[] = [];
            const errors: string[] = [];

            for (const conn of importData.connections) {
                try {
                    const processedConn = this.processImportedConnection(conn, decryptionPassword);
                    validConnections.push({
                        ...processedConn,
                        id: this.generateId(),
                        isConnected: false,
                        lastConnected: undefined
                    });
                } catch (error) {
                    errors.push(error instanceof Error ? error.message : 'Erreur inconnue');
                }
            }

            if (validConnections.length === 0) {
                const errorMessage = errors.length > 0
                    ? `Aucune connexion valide trouvée. Erreurs :\n${errors.join('\n')}`
                    : 'Aucune connexion valide trouvée dans le fichier d\'importation';
                throw new Error(errorMessage);
            }

            // TODO : Modifier pour mettre à jour les connexions existantes et ajouter celles qui n'existe pas encore par défaut.
            // TODO : Donc, Plus besoin de demander si on ajoute ou remplace. (Corriger/Supprimer aussi handleConnectionImport())
            // Déterminer le mode d'importation
            let importMode = 'merge';
            if (this.connections.length > 0) {
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
                for (const importedConn of validConnections) {
                    const result = await this.handleConnectionImport(importedConn, true);
                    if (result.action === 'added') addedCount++;
                    else if (result.action === 'updated') updatedCount++;
                }
            } else {
                // Mode fusion : demander confirmation pour les doublons
                for (const importedConn of validConnections) {
                    const result = await this.handleConnectionImport(importedConn, autoUpdate);
                    autoUpdate = result.autoUpdate;

                    if (result.action === 'added') addedCount++;
                    else if (result.action === 'updated') updatedCount++;
                    else if (result.action === 'skipped') skippedCount++;
                }
            }

            await this.saveConnections();

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