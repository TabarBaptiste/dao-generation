import { DatabaseConnection, ConnectionFormData } from '../types/Connection';

/**
 * Factory class for creating database connection objects
 * Centralizes connection creation logic to eliminate duplication
 */
export class DatabaseConnectionFactory {
    /**
     * Creates a complete DatabaseConnection object with generated ID
     * @param data Connection form data
     * @returns Complete DatabaseConnection object
     */
    static createConnectionData(data: ConnectionFormData): Omit<DatabaseConnection, 'id'> {
        return {
            name: data.name,
            host: data.host,
            port: data.port,
            username: data.username,
            password: data.password || '',
            database: data.database || undefined,
            type: data.type,
            isConnected: false
        };
    }

    /**
     * Creates a temporary connection for testing purposes
     * @param data Raw connection data from forms/UI
     * @returns DatabaseConnection with temporary ID
     */
    static createTempConnection(data: {
        name: string;
        host: string;
        port: number;
        username: string;
        password?: string;
        database?: string;
        type: 'mysql' | 'mariadb';
    }): DatabaseConnection {
        return {
            id: 'temp',
            name: data.name,
            host: data.host,
            port: data.port,
            username: data.username,
            password: data.password || '',
            database: data.database,
            type: data.type,
            isConnected: false
        };
    }
}