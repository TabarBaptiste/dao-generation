import * as mysql from 'mysql2/promise';
import { DatabaseConnection, TableInfo, ColumnInfo } from '../types/Connection';
import { DATABASE_SYSTEM_SCHEMAS } from '../constants/AppConstants';
import { ErrorHandler } from '../utils/ErrorHandler';

export class DatabaseService {
    private connections: Map<string, mysql.Connection> = new Map();

    public async testConnection(connection: Omit<DatabaseConnection, 'id'>): Promise<{ success: boolean, message: string }> {
        try {
            const conn = await this.createConnection(connection);
            await conn.ping();
            await conn.end();
            return { success: true, message: 'Connexion réussie !' };
        } catch (error: any) {
            console.log('Code d\'erreur MySQL:', error.code);
            console.log('Message d\'erreur MySQL:', error.message);

            if (error.code === 'ENOTFOUND') {
                return { success: false, message: 'Host introuvable. Vérifiez l\'adresse du serveur.' };
            } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                return { success: false, message: 'Accès refusé. Vérifiez vos identifiants.' };
            } else if (error.code === 'ETIMEDOUT') {
                return { success: false, message: 'Timeout de connexion. Vérifiez le port et la connectivité réseau.' };
            } else if (error.code === 'ECONNREFUSED') {
                return { success: false, message: 'Connexion refusée. Le serveur MySQL n\'est pas démarré ou le port est incorrect.' };
            } else {
                return { success: false, message: `Erreur de connexion: ${error.code || 'Inconnue'}` };
            }
        }
    }

    public async connect(connection: DatabaseConnection): Promise<void> {
        // Tester la connexion d'abord avec gestion d'erreur personnalisée
        const testResult = await this.testConnection(connection);

        if (!testResult.success) {
            throw new Error(testResult.message);
        }

        try {
            // Fermer la connexion existante s'il y en a une
            await this.disconnect(connection.id);

            // Créer la connexion persistante
            const conn = await this.createConnection(connection);
            this.connections.set(connection.id, conn);

            console.log(`dao Connecté à ${connection.name}`);
        } catch (error) {
            console.error(`Échec de la connexion à ${connection.name}:`, error);
            throw error;
        }
    }

    public async disconnect(connectionId: string): Promise<void> {
        const conn = this.connections.get(connectionId);
        if (conn) {
            try {
                await conn.end();
                this.connections.delete(connectionId);
                console.log(`dao Déconnecté de la connexion ${connectionId}`);
            } catch (error) {
                console.error(`Erreur lors de la déconnexion de ${connectionId}:`, error);
            }
        }
    }

    public isConnected(connectionId: string): boolean {
        return this.connections.has(connectionId);
    }

    public async getDatabases(connection: DatabaseConnection): Promise<string[]> {
        try {
            const conn = await this.createConnection(connection);
            const [rows] = await conn.execute('SHOW DATABASES');
            await conn.end();

            const databases = (rows as any[])
                .map(row => row.Database)
                .filter(db => !DATABASE_SYSTEM_SCHEMAS.includes(db));

            return databases;
        } catch (error) {
            console.error('Échec de la récupération des bases de données:', error);
            throw error;
        }
    }

    public async getTables(connection: DatabaseConnection, database: string): Promise<string[]> {
        if (!database) {
            return [];
        }

        try {
            // Utiliser une connexion temporaire comme le fait getDatabases
            const conn = await this.createConnection(connection);

            // Utiliser SHOW TABLES FROM database au lieu de USE + SHOW TABLES
            const [rows] = await conn.execute(`SHOW TABLES FROM \`${database}\``);

            await conn.end();

            const tableKey = `Tables_in_${database}`;
            return (rows as any[]).map(row => row[tableKey]);
        } catch (error) {
            console.error('Échec de la récupération des tables:', error);
            throw error;
        }
    }

    public async getTableInfo(connection: DatabaseConnection, database: string, tableName: string): Promise<TableInfo> {
        try {
            // Utiliser une connexion temporaire comme les autres méthodes
            const conn = await this.createConnection(connection);

            // Utiliser DESCRIBE database.table au lieu de USE + DESCRIBE
            const [rows] = await conn.execute(`DESCRIBE \`${database}\`.\`${tableName}\``);

            await conn.end();

            const columns: ColumnInfo[] = (rows as any[]).map(row => ({
                name: row.Field,
                type: row.Type,
                nullable: row.Null === 'YES',
                key: row.Key || '',
                default: row.Default,
                extra: row.Extra || ''
            }));

            return {
                name: tableName,
                columns
            };
        } catch (error) {
            console.error('Échec de la récupération des informations de table:', error);
            throw error;
        }
    }

    private async createConnection(connection: Omit<DatabaseConnection, 'id'>): Promise<mysql.Connection> {
        const config: mysql.ConnectionOptions = {
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: connection.database,
            connectTimeout: 5000
        };

        return await mysql.createConnection(config);
    }

    public async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.connections.keys()).map(id => this.disconnect(id));
        await Promise.all(disconnectPromises);
    }
}