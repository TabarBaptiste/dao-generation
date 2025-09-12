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
                        ErrorHandler.logError('connection decryption', `Failed to decrypt password for connection: ${conn.name}`);
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
                ErrorHandler.logError('connection encryption', `Failed to encrypt password for connection: ${conn.name}`);
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
                vscode.window.showInformationMessage('No connections to export.');
                return;
            }

            // Ask for encryption password
            const encryptionPassword = await vscode.window.showInputBox({
                prompt: 'Enter a password to encrypt the connection passwords (leave empty for unencrypted export)',
                password: true,
                placeHolder: 'Encryption password (optional)'
            });

            if (encryptionPassword === undefined) {
                return; // User cancelled
            }

            const useEncryption = encryptionPassword && encryptionPassword.trim().length > 0;

            // Create export data structure
            const exportData = {
                exportDate: new Date().toISOString(),
                version: '1.0.0',
                encrypted: useEncryption,
                connections: this.connections.map(conn => {
                    const exportConn = {
                        ...conn,
                        // Remove runtime properties that shouldn't be exported
                        isConnected: undefined,
                        lastConnected: undefined
                    };

                    // Encrypt password if encryption is enabled
                    if (useEncryption && encryptionPassword) {
                        const encrypted = EncryptionUtil.safeEncrypt(conn.password, encryptionPassword);
                        if (!encrypted) {
                            ErrorHandler.logError('export encryption', `Failed to encrypt password for connection: ${conn.name}`);
                            return exportConn; // Return without encrypted password
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

            // Show save dialog
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('php-dao-connections.json'),
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                },
                saveLabel: 'Export Connections'
            });

            if (saveUri) {
                const jsonContent = JSON.stringify(exportData, null, 2);
                await vscode.workspace.fs.writeFile(saveUri, Buffer.from(jsonContent, 'utf8'));

                const encryptionStatus = useEncryption ? ' (passwords encrypted)' : ' (passwords in plain text)';
                vscode.window.showInformationMessage(`Successfully exported ${this.connections.length} connection(s) to ${saveUri.fsPath}${encryptionStatus}`);
            }
        } catch (error) {
            ErrorHandler.logError('export connections', error);
            ErrorHandler.showError('export connections', error);
        }
    }

    public async importConnections(): Promise<void> {
        try {
            // Show open dialog
            const openUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                },
                openLabel: 'Import Connections'
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
                throw new Error('Invalid JSON file format');
            }

            // Validate import data structure
            if (!importData.connections || !Array.isArray(importData.connections)) {
                throw new Error('Invalid file format: missing connections array');
            }

            // Check if file contains encrypted passwords
            const isEncrypted = importData.encrypted === true;
            let decryptionPassword: string | undefined;

            if (isEncrypted) {
                decryptionPassword = await vscode.window.showInputBox({
                    prompt: 'This file contains encrypted passwords. Enter the decryption password:',
                    password: true,
                    placeHolder: 'Decryption password'
                });

                if (!decryptionPassword) {
                    vscode.window.showWarningMessage('Import cancelled: decryption password is required for encrypted files.');
                    return;
                }
            }

            // Validate and decrypt connections
            const validConnections = [];
            const errors = [];

            for (const conn of importData.connections) {
                try {
                    // Basic validation
                    if (!conn.name || !conn.host || !conn.port || !conn.username ||
                        !conn.type || !['mysql', 'mariadb'].includes(conn.type)) {
                        errors.push(`Invalid connection format: ${conn.name || 'unnamed'}`);
                        continue;
                    }

                    // Handle password decryption if needed
                    let password = conn.password;
                    if (isEncrypted && decryptionPassword) {
                        if (!conn.passwordIv) {
                            errors.push(`Missing encryption data for connection: ${conn.name}`);
                            continue;
                        }
                        try {
                            password = EncryptionUtil.safeDecrypt(conn.password, conn.passwordIv, decryptionPassword);
                            if (password === null) {
                                errors.push(`Failed to decrypt password for connection: ${conn.name}`);
                                continue;
                            }
                        } catch (decryptError) {
                            errors.push(`Failed to decrypt password for connection: ${conn.name}`);
                            continue;
                        }
                    }

                    validConnections.push({
                        ...conn,
                        password: password,
                        passwordIv: undefined // Remove encryption metadata
                    });
                } catch (error) {
                    errors.push(`Error processing connection ${conn.name || 'unnamed'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            if (validConnections.length === 0) {
                const errorMessage = errors.length > 0
                    ? `No valid connections found. Errors:\n${errors.join('\n')}`
                    : 'No valid connections found in the import file';
                throw new Error(errorMessage);
            }

            // Ask user if they want to replace existing connections or merge
            let importMode = 'merge';
            if (this.connections.length > 0) {
                const choice = await vscode.window.showQuickPick([
                    {
                        label: 'Merge (Smart)',
                        description: 'Add new connections and update existing ones (no duplicates)',
                        value: 'merge'
                    },
                    {
                        label: 'Replace (Smart)',
                        description: 'Replace only the connections being imported (others are kept)',
                        value: 'replace'
                    }
                ], {
                    placeHolder: 'Choose import mode'
                });

                if (!choice) {
                    return; // User cancelled
                }

                importMode = choice.value;
            }

            // Import connections avec gestion intelligente des doublons
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
                // Mode Replace (Smart): Remplacer seulement les connexions importées
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
                // Mode Merge (Smart): Ajouter seulement les nouvelles, mettre à jour les existantes
                for (const importedConn of importedConnections) {
                    const existingIndex = this.connections.findIndex(conn =>
                        this.isSameConnection(conn, importedConn)
                    );

                    if (existingIndex !== -1) {
                        // Connexion existante trouvée
                        if (!autoUpdateRemaining) {
                            // Demander si on veut mettre à jour la connexion existante
                            const updateChoice = await vscode.window.showQuickPick([
                                { label: 'Yes', description: 'Update this connection', value: 'yes' },
                                { label: 'No', description: 'Keep the existing connection', value: 'no' },
                                { label: 'Yes to all', description: 'Update this and all remaining duplicates', value: 'yesAll' }
                            ], {
                                placeHolder: `Connection "${importedConn.name}" already exists. Update it?`
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
                            // Mode auto-update activé
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

            let message = `Successfully imported connections: ${addedCount} added`;
            if (updatedCount > 0) {
                message += `, ${updatedCount} updated`;
            }
            if (skippedCount > 0) {
                message += `, ${skippedCount} skipped`;
            }
            if (errors.length > 0) {
                message += ` (${errors.length} connections had errors)`;
            }
            if (isEncrypted) {
                message += ` (passwords were decrypted)`;
            }

            vscode.window.showInformationMessage(message);

            // Show detailed errors if any
            if (errors.length > 0 && errors.length < 10) { // Don't spam if too many errors
                const showErrors = await vscode.window.showWarningMessage(
                    `Some connections could not be imported. Show details?`,
                    'Show Details'
                );
                if (showErrors) {
                    const errorDetails = errors.join('\n');
                    vscode.window.showErrorMessage(`Import errors:\n${errorDetails}`);
                }
            }
        } catch (error) {
            ErrorHandler.logError('import connections', error);
            ErrorHandler.showError('import connections', error);
        }
    }
}