import * as vscode from 'vscode';
import { DatabaseConnection } from '../types/Connection';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class ConnectionManager {
    private static readonly STORAGE_KEY = 'phpDaoGenerator.connections';
    private connections: DatabaseConnection[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.loadConnections();
    }

    public getConnections(): DatabaseConnection[] {
        return this.connections;
    }

    public async addConnection(connection: Omit<DatabaseConnection, 'id'>): Promise<void> {
        const newConnection: DatabaseConnection = {
            ...connection,
            id: this.generateId(),
            isConnected: false
        };

        this.connections.push(newConnection);
        await this.saveConnections();
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
        const stored = this.context.globalState.get<DatabaseConnection[]>(ConnectionManager.STORAGE_KEY);
        console.log('stored :', stored);
        if (stored) {
            this.connections = stored;
        }
    }

    private async saveConnections(): Promise<void> {
        await this.context.globalState.update(ConnectionManager.STORAGE_KEY, this.connections);
    }

    private generateId(): string {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private encryptPassword(password: string, masterKey: string): { encrypted: string, iv: string } {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(masterKey, 'salt', 32);
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex')
        };
    }

    private decryptPassword(encryptedData: string, iv: string, masterKey: string): string {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(masterKey, 'salt', 32);
        const ivBuffer = Buffer.from(iv, 'hex');
        
        const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
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
                        const encrypted = this.encryptPassword(conn.password, encryptionPassword);
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
            console.error('Export error:', error);
            vscode.window.showErrorMessage(`Failed to export connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                            password = this.decryptPassword(conn.password, conn.passwordIv, decryptionPassword);
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
            let shouldReplace = false;
            if (this.connections.length > 0) {
                const choice = await vscode.window.showQuickPick([
                    { label: 'Merge', description: 'Add imported connections to existing ones', value: 'merge' },
                    { label: 'Replace', description: 'Replace all existing connections with imported ones', value: 'replace' }
                ], {
                    placeHolder: 'Choose import mode'
                });

                if (!choice) {
                    return; // User cancelled
                }
                
                shouldReplace = choice.value === 'replace';
            }

            // Import connections
            const importedConnections: DatabaseConnection[] = validConnections.map((conn: any) => ({
                ...conn,
                id: this.generateId(),
                isConnected: false,
                lastConnected: undefined
            }));

            if (shouldReplace) {
                this.connections = importedConnections;
            } else {
                this.connections.push(...importedConnections);
            }

            await this.saveConnections();

            let message = `Successfully imported ${importedConnections.length} connection(s)`;
            if (errors.length > 0) {
                message += ` (${errors.length} connections skipped due to errors)`;
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
            console.error('Import error:', error);
            vscode.window.showErrorMessage(`Failed to import connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}