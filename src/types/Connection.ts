export interface DatabaseConnection {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    database?: string;
    type: 'mysql' | 'mariadb';
    isConnected?: boolean;
    lastConnected?: Date;
}

export interface ConnectionFormData {
    name: string;
    host: string;
    port: string;
    username: string;
    password: string;
    database: string;
    type: 'mysql' | 'mariadb';
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