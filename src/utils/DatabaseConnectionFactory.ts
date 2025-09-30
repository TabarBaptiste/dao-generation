import { DatabaseServeur, ServeurFormData } from '../types/Connection';

/**
 * Factory class for creating database serveurs objects
 * Centralizes serveurs creation logic to eliminate duplication
 */
export class DatabaseServeurFactory {
    /**
     * Creates a complete DatabaseServeur object with generated ID
     * @param data Serveur form data
     * @returns Complete DatabaseServeur object
     */
    static createServeurData(data: ServeurFormData): Omit<DatabaseServeur, 'id'> {
        return {
            name: data.name,
            host: data.host,
            port: data.port,
            username: data.username,
            password: data.password || '',
            database: data.database || undefined,
            type: data.type,
            isConnected: false,
            defaultDaoPath: data.defaultDaoPath
        };
    }

    /**
     * Creates a temporary serveurs for testing purposes
     * @param data Raw serveurs data from forms/UI
     * @returns DatabaseServeur with temporary ID
     */
    static createTempServeur(data: {
        name: string;
        host: string;
        port: number;
        username: string;
        password?: string;
        database?: string;
        type: 'mysql' | 'mariadb';
    }): DatabaseServeur {
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