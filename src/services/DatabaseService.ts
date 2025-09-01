import * as mysql from 'mysql2/promise';
import { DatabaseConnection, TableInfo, ColumnInfo } from '../types/Connection';

export class DatabaseService {
    private connections: Map<string, mysql.Connection> = new Map();

    public async testConnection(connection: DatabaseConnection): Promise<boolean> {
        try {
            const conn = await this.createConnection(connection);
            await conn.ping();
            await conn.end();
            return true;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }

    public async connect(connection: DatabaseConnection): Promise<void> {
        try {
            // Close existing connection if any
            await this.disconnect(connection.id);

            const conn = await this.createConnection(connection);
            this.connections.set(connection.id, conn);

            console.log(`Connected to ${connection.name}`);
        } catch (error) {
            console.error(`Failed to connect to ${connection.name}:`, error);
            throw error;
        }
    }

    public async disconnect(connectionId: string): Promise<void> {
        const conn = this.connections.get(connectionId);
        if (conn) {
            try {
                await conn.end();
                this.connections.delete(connectionId);
                console.log(`Disconnected from connection ${connectionId}`);
            } catch (error) {
                console.error(`Error disconnecting from ${connectionId}:`, error);
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
                .filter(db => !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(db));

            return databases;
        } catch (error) {
            console.error('Failed to get databases:', error);
            throw error;
        }
    }

    public async getTables(connection: DatabaseConnection, database: string): Promise<string[]> {
        console.log('database :', database);
        if (!database) {
            return [];
        }

        try {
            // Use a temporary connection like getDatabases does
            const conn = await this.createConnection(connection);
            
            // Use SHOW TABLES FROM database instead of USE + SHOW TABLES
            const [rows] = await conn.execute(`SHOW TABLES FROM \`${database}\``);

            await conn.end();

            const tableKey = `Tables_in_${database}`;
            return (rows as any[]).map(row => row[tableKey]);
        } catch (error) {
            console.error('Failed to get tables:', error);
            throw error;
        }
    }

    public async getTableInfo(connection: DatabaseConnection, database: string, tableName: string): Promise<TableInfo> {
        try {
            const conn = this.connections.get(connection.id);
            if (!conn) {
                throw new Error('Connection not established');
            }

            // Use DESCRIBE database.table instead of USE + DESCRIBE
            const [rows] = await conn.execute(`DESCRIBE \`${database}\`.\`${tableName}\``);

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
            console.error('Failed to get table info:', error);
            throw error;
        }
    }

    private async createConnection(connection: DatabaseConnection): Promise<mysql.Connection> {
        const config: mysql.ConnectionOptions = {
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: connection.database,
            connectTimeout: 10000
        };

        return await mysql.createConnection(config);
    }

    public async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.connections.keys()).map(id => this.disconnect(id));
        await Promise.all(disconnectPromises);
    }
}