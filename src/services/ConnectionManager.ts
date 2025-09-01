import * as vscode from 'vscode';
import { DatabaseConnection } from '../types/Connection';

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
}