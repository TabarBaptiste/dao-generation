export interface DatabaseServeur {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    database?: string;
    type: 'mysql' | 'mariadb' | 'postgresql';
    isConnected?: boolean;
    lastConnected?: Date;
    defaultDaoPath?: string;
    // Options SSL/TLS
    ssl?: boolean;
    sslCa?: string;
    sslCert?: string;
    sslKey?: string;
    rejectUnauthorized?: boolean;
}

export interface ServeurFormData {
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    database: string;
    type: 'mysql' | 'mariadb' | 'postgresql';
    defaultDaoPath?: string;
    // Options SSL/TLS
    ssl?: boolean;
    sslCa?: string;
    sslCert?: string;
    sslKey?: string;
    rejectUnauthorized?: boolean;
}

export interface TableInfo {
    name: string;
    columns: ColumnInfo[];
}

export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    key: 'PRI' | 'UNI' | 'MUL' | '';
    default: string | null;
    extra: string;
}

export interface DaoGenerationOptions {
    mode: 'save' | 'overwrite';
    outputPath?: string;
}

/**
 * Type pour le stockage local - inclut les propriétés de chiffrement
 */
export type ServeurForStorage = Omit<DatabaseServeur, 'isConnected' | 'lastConnected'> & {
    encryptedPassword?: string;
    passwordIv?: string;
};

/**
 * Type pour l'export - exclut les propriétés runtime et stockage local
 */
export type ServeurForExport = Omit<DatabaseServeur, 'isConnected' | 'lastConnected'> & {
    passwordIv?: string;
};

/**
 * Type pour l'import - structure flexible avec toutes les propriétés optionnelles sauf les essentielles
 */
export type ServeurForImport = {
    id?: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    database?: string;
    type: 'mysql' | 'mariadb' | 'postgresql';
    defaultDaoPath?: string;
    passwordIv?: string;
    encryptedPassword?: string;
};

/**
 * Structure des données d'export de serveurs
 */
export interface ExportData {
    exportDate: string;
    encrypted: boolean;
    serveurs: ServeurForExport[];
}

/**
 * Structure des données d'import de serveurs
 */
export interface ImportData {
    exportDate?: string;
    encrypted?: boolean;
    serveurs: ServeurForImport[];
}