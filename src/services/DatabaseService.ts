import * as mysql from 'mysql2/promise';
import { DatabaseServeur, TableInfo, ColumnInfo } from '../types/Connection';
import { DATABASE_SYSTEM_SCHEMAS } from '../constants/AppConstants';
import { ErrorHandler } from '../utils/ErrorHandler';

export class DatabaseService {
    private serveurs: Map<string, mysql.Connection> = new Map();

    public async testConnection(serveurs: Omit<DatabaseServeur, 'id'>): Promise<{ success: boolean, message: string }> {
        try {
            const conn = await this.createServeur(serveurs);
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

    public async connect(serveurs: DatabaseServeur): Promise<void> {
        // Tester le serveur d'abord avec gestion d'erreur personnalisée
        const testResult = await this.testConnection(serveurs);

        if (!testResult.success) {
            throw new Error(testResult.message);
        }

        try {
            // Fermer le serveur existante s'il y en a une
            await this.disconnect(serveurs.id);

            // Créer le serveur persistante
            const conn = await this.createServeur(serveurs);
            this.serveurs.set(serveurs.id, conn);

            console.log(`dao Connecté à ${serveurs.name}`);
        } catch (error) {
            console.error(`Échec du serveur à ${serveurs.name}:`, error);
            throw error;
        }
    }

    public async disconnect(connectionId: string): Promise<void> {
        const conn = this.serveurs.get(connectionId);
        if (conn) {
            try {
                await conn.end();
                this.serveurs.delete(connectionId);
                console.log(`dao Déconnecté du serveur ${connectionId}`);
            } catch (error) {
                console.error(`Erreur lors de la déconnexion de ${connectionId}:`, error);
            }
        }
    }

    public isConnected(connectionId: string): boolean {
        return this.serveurs.has(connectionId);
    }

    public async getDatabases(serveurs: DatabaseServeur): Promise<string[]> {
        try {
            const conn = await this.createServeur(serveurs);
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

    public async getTables(serveurs: DatabaseServeur, database: string): Promise<string[]> {
        if (!database) {
            return [];
        }

        try {
            // Utiliser un serveur temporaire comme le fait getDatabases
            const conn = await this.createServeur(serveurs);

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

    public async getTableInfo(serveurs: DatabaseServeur, database: string, tableName: string): Promise<TableInfo> {
        try {
            // Utiliser un serveur temporaire comme les autres méthodes
            const conn = await this.createServeur(serveurs);

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

    private async createServeur(serveurs: Omit<DatabaseServeur, 'id'>): Promise<mysql.Connection> {
        const config: mysql.ConnectionOptions = {
            host: serveurs.host,
            port: serveurs.port,
            user: serveurs.username,
            password: serveurs.password,
            database: serveurs.database,
            connectTimeout: 5000
        };

        return await mysql.createConnection(config);
    }

    public async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.serveurs.keys()).map(id => this.disconnect(id));
        await Promise.all(disconnectPromises);
    }
}