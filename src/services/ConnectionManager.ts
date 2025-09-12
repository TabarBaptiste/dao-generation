import * as vscode from 'vscode';
import { DatabaseConnection } from '../types/Connection';
import * as fs from 'fs';
import * as path from 'path';
import { EncryptionUtil } from '../utils/EncryptionUtil';
import { ErrorHandler } from '../utils/ErrorHandler';
import { STORAGE_KEYS, ENCRYPTION } from '../constants/AppConstants';

export class ConnectionManager {
    private static readonly STORAGE_KEY = STORAGE_KEYS.CONNECTIONS;
    private static readonly ENCRYPTION_KEY = ENCRYPTION.KEY;
    private connections: DatabaseConnection[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.loadConnections();
    }

    public getConnections(): DatabaseConnection[] {
        return this.connections;
    }

    public async addConnection(connection: Omit<DatabaseConnection, 'id'>): Promise<boolean> {
        const newConnection: DatabaseConnection = {
            ...connection,
            id: this.generateId(),
            isConnected: true
        };

        // Vérifier s'il existe déjà une connexion identique
        const existingConnection = this.connections.find(conn => this.isSameConnection(conn, newConnection));

        if (existingConnection) {
            // Retourner false pour indiquer que la connexion n'a pas été ajoutée (doublon détecté)
            return false;
        }

        this.connections.push(newConnection);
        await this.saveConnections();
        return true;
    }

    public async updateConnection(id: string, connection: Partial<DatabaseConnection>): Promise<void> {
        const index = this.connections.findIndex(conn => conn.id === id);
        if (index !== -1) {
            this.connections[index] = { ...this.connections[index], ...connection };
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

    private async loadConnections(): Promise<void> {
        const stored = this.context.globalState.get<any[]>(ConnectionManager.STORAGE_KEY);
        console.log('dao stored :', stored);
        if (stored) {
            // Déchiffrer les mots de passe lors du chargement
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
                        return {
                            ...conn,
                            password: '',
                            encryptedPassword: undefined,
                            passwordIv: undefined
                        };
                    }
                    return {
                        ...conn,
                        password: decryptedPassword,
                        encryptedPassword: undefined,
                        passwordIv: undefined
                    };
                }
                // Si pas de chiffrement, retourner tel quel (rétrocompatibilité)
                return conn;
            });
        }
    }

    private async saveConnections(): Promise<void> {
        // Chiffrer les mots de passe avant la sauvegarde
        const connectionsToSave = this.connections.map(conn => {
            const encrypted = EncryptionUtil.safeEncrypt(conn.password, ConnectionManager.ENCRYPTION_KEY);
            if (!encrypted) {
                ErrorHandler.logError('chiffrement connexion', `Échec du chiffrement du mot de passe pour la connexion : ${conn.name}`);
                return {
                    ...conn,
                    password: undefined,
                    encryptedPassword: undefined,
                    passwordIv: undefined
                };
            }
            return {
                ...conn,
                password: undefined, // Supprimer le mot de passe en clair
                encryptedPassword: encrypted.encrypted,
                passwordIv: encrypted.iv
            };
        });

        await this.context.globalState.update(ConnectionManager.STORAGE_KEY, connectionsToSave);
    }

    private generateId(): string {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Vérifie si deux connexions sont identiques (même serveur, même base de données)
     */
    private isSameConnection(conn1: DatabaseConnection, conn2: DatabaseConnection): boolean {
        // Normaliser les valeurs de base de données (undefined, null, "" sont tous traités comme "pas de base")
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

    public async exportConnections(): Promise<void> {
        try {
            if (this.connections.length === 0) {
                vscode.window.showInformationMessage('Aucune connexion à exporter.');
                return;
            }

            // Demander un mot de passe de chiffrement
            const encryptionPassword = await vscode.window.showInputBox({
                prompt: 'Entrez un mot de passe pour chiffrer les mots de passe de connexion (laisser vide pour une exportation non chiffrée)',
                password: true,
                placeHolder: 'Mot de passe de chiffrement (facultatif)'
            });

            if (encryptionPassword === undefined) {
                return; // Utilisateur a annulé
            }

            const useEncryption = encryptionPassword && encryptionPassword.trim().length > 0;

            // Créer la structure de données d'exportation
            const exportData = {
                exportDate: new Date().toISOString(),
                version: '1.0.0',
                encrypted: useEncryption,
                connections: this.connections.map(conn => {
                    const exportConn = {
                        ...conn,
                        // Supprimer les propriétés d'exécution qui ne doivent pas être exportées
                        isConnected: undefined,
                        lastConnected: undefined
                    };

                    // Chiffrer le mot de passe si le chiffrement est activé
                    if (useEncryption && encryptionPassword) {
                        const encrypted = EncryptionUtil.safeEncrypt(conn.password, encryptionPassword);
                        if (!encrypted) {
                            ErrorHandler.logError('chiffrement exportation', `Échec du chiffrement du mot de passe pour la connexion : ${conn.name}`);
                            return exportConn; // Retourner sans mot de passe chiffré
                        }
                        return {
                            ...exportConn,
                            password: encrypted.encrypted,
                            passwordIv: encrypted.iv
                        };
                    }

                    return exportConn;
                })
            };

            // Afficher la boîte de dialogue de sauvegarde
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('php-dao-connections.json'),
                filters: {
                    'Fichiers JSON': ['json'],
                    'Tous les fichiers': ['*']
                },
                saveLabel: 'Exporter les connexions'
            });

            if (saveUri) {
                const jsonContent = JSON.stringify(exportData, null, 2);
                await vscode.workspace.fs.writeFile(saveUri, Buffer.from(jsonContent, 'utf8'));

                const encryptionStatus = useEncryption ? ' (mots de passe chiffrés)' : ' (mots de passe en texte clair)';
                vscode.window.showInformationMessage(`${this.connections.length} connexion(s) exportée(s) avec succès vers ${saveUri.fsPath}${encryptionStatus}`);
            }
        } catch (error) {
            ErrorHandler.logError('exportation connexions', error);
            ErrorHandler.showError('exportation connexions', error);
        }
    }

    public async importConnections(): Promise<void> {
        try {
            // Afficher la boîte de dialogue d'ouverture
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

            const fileUri = openUri[0];
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const jsonContent = Buffer.from(fileContent).toString('utf8');

            let importData: any;
            try {
                importData = JSON.parse(jsonContent);
            } catch (parseError) {
                throw new Error('Format de fichier JSON invalide');
            }

            // Valider la structure des données d'importation
            if (!importData.connections || !Array.isArray(importData.connections)) {
                throw new Error('Format de fichier invalide : tableau de connexions manquant');
            }

            // Vérifier si le fichier contient des mots de passe chiffrés
            const isEncrypted = importData.encrypted === true;
            let decryptionPassword: string | undefined;

            if (isEncrypted) {
                decryptionPassword = await vscode.window.showInputBox({
                    prompt: 'Ce fichier contient des mots de passe chiffrés. Entrez le mot de passe de déchiffrement :',
                    password: true,
                    placeHolder: 'Mot de passe de déchiffrement'
                });

                if (!decryptionPassword) {
                    vscode.window.showWarningMessage('Importation annulée : un mot de passe de déchiffrement est requis pour les fichiers chiffrés.');
                    return;
                }
            }

            // Valider et déchiffrer les connexions
            const validConnections = [];
            const errors = [];

            for (const conn of importData.connections) {
                try {
                    // Validation de base
                    if (!conn.name || !conn.host || !conn.port || !conn.username ||
                        !conn.type || !['mysql', 'mariadb'].includes(conn.type)) {
                        errors.push(`Format de connexion invalide : ${conn.name || 'sans nom'}`);
                        continue;
                    }

                    // Gérer le déchiffrement du mot de passe si nécessaire
                    let password = conn.password;
                    if (isEncrypted && decryptionPassword) {
                        if (!conn.passwordIv) {
                            errors.push(`Données de chiffrement manquantes pour la connexion : ${conn.name}`);
                            continue;
                        }
                        try {
                            password = EncryptionUtil.safeDecrypt(conn.password, conn.passwordIv, decryptionPassword);
                            if (password === null) {
                                errors.push(`Échec du déchiffrement du mot de passe pour la connexion : ${conn.name}`);
                                continue;
                            }
                        } catch (decryptError) {
                            errors.push(`Échec du déchiffrement du mot de passe pour la connexion : ${conn.name}`);
                            continue;
                        }
                    }

                    validConnections.push({
                        ...conn,
                        password: password,
                        passwordIv: undefined // Supprimer les métadonnées de chiffrement
                    });
                } catch (error) {
                    errors.push(`Erreur lors du traitement de la connexion ${conn.name || 'sans nom'} : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
                }
            }

            if (validConnections.length === 0) {
                const errorMessage = errors.length > 0
                    ? `Aucune connexion valide trouvée. Erreurs :\n${errors.join('\n')}`
                    : 'Aucune connexion valide trouvée dans le fichier d\'importation';
                throw new Error(errorMessage);
            }

            // Demander à l'utilisateur s'il veut remplacer les connexions existantes ou fusionner
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
                    return; // Utilisateur a annulé
                }

                importMode = choice.value;
            }

            // Importer les connexions avec gestion intelligente des doublons
            const importedConnections: DatabaseConnection[] = validConnections.map((conn: any) => ({
                ...conn,
                id: this.generateId(),
                isConnected: false,
                lastConnected: undefined
            }));

            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            let autoUpdateRemaining = false;

            if (importMode === 'replace') {
                // Mode Remplacement (Intelligent): Remplacer seulement les connexions importées
                for (const importedConn of importedConnections) {
                    const existingIndex = this.connections.findIndex(conn =>
                        this.isSameConnection(conn, importedConn)
                    );

                    if (existingIndex !== -1) {
                        // Remplacer la connexion existante en gardant l'ID original
                        this.connections[existingIndex] = {
                            ...importedConn,
                            id: this.connections[existingIndex].id
                        };
                        updatedCount++;
                    } else {
                        // Ajouter la nouvelle connexion
                        this.connections.push(importedConn);
                        addedCount++;
                    }
                }
            } else {
                // Mode Fusion (Intelligent): Ajouter seulement les nouvelles, mettre à jour les existantes
                for (const importedConn of importedConnections) {
                    const existingIndex = this.connections.findIndex(conn =>
                        this.isSameConnection(conn, importedConn)
                    );

                    if (existingIndex !== -1) {
                        // Connexion existante trouvée
                        if (!autoUpdateRemaining) {
                            // Demander si on veut mettre à jour la connexion existante
                            const updateChoice = await vscode.window.showQuickPick([
                                { label: 'Oui', description: 'Mettre à jour cette connexion', value: 'yes' },
                                { label: 'Non', description: 'Conserver la connexion existante', value: 'no' },
                                { label: 'Oui pour tout', description: 'Mettre à jour celle-ci et tous les doublons restants', value: 'yesAll' }
                            ], {
                                placeHolder: `La connexion "${importedConn.name}" existe déjà. La mettre à jour ?`
                            });

                            if (!updateChoice) {
                                skippedCount++;
                                continue;
                            }

                            if (updateChoice.value === 'yesAll') {
                                autoUpdateRemaining = true;
                            }

                            if (updateChoice.value === 'yes' || updateChoice.value === 'yesAll') {
                                // Mettre à jour la connexion existante en gardant l'ID original
                                this.connections[existingIndex] = {
                                    ...importedConn,
                                    id: this.connections[existingIndex].id
                                };
                                updatedCount++;
                            } else {
                                skippedCount++;
                            }
                        } else {
                            // Mode mise à jour automatique activé
                            this.connections[existingIndex] = {
                                ...importedConn,
                                id: this.connections[existingIndex].id
                            };
                            updatedCount++;
                        }
                    } else {
                        // Ajouter la nouvelle connexion
                        this.connections.push(importedConn);
                        addedCount++;
                    }
                }
            }

            await this.saveConnections();

            let message = `Connexions importées avec succès : ${addedCount} ajoutées`;
            if (updatedCount > 0) {
                message += `, ${updatedCount} mises à jour`;
            }
            if (skippedCount > 0) {
                message += `, ${skippedCount} ignorées`;
            }
            if (errors.length > 0) {
                message += ` (${errors.length} connexions ont eu des erreurs)`;
            }
            if (isEncrypted) {
                message += ` (mots de passe déchiffrés)`;
            }

            vscode.window.showInformationMessage(message);

            // Afficher les erreurs détaillées si il y en a
            if (errors.length > 0 && errors.length < 10) { // Ne pas spammer si trop d'erreurs
                const showErrors = await vscode.window.showWarningMessage(
                    `Certaines connexions n'ont pas pu être importées. Afficher les détails ?`,
                    'Afficher les détails'
                );
                if (showErrors) {
                    const errorDetails = errors.join('\n');
                    vscode.window.showErrorMessage(`Erreurs d'importation :\n${errorDetails}`);
                }
            }
        } catch (error) {
            ErrorHandler.logError('importation connexions', error);
            ErrorHandler.showError('importation connexions', error);
        }
    }
}