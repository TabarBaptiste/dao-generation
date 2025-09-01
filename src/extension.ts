import * as vscode from 'vscode';
import { DatabaseConnectionProvider } from './providers/DatabaseConnectionProvider';
import { ConnectionManager } from './services/ConnectionManager';
import { DatabaseService } from './services/DatabaseService';

export function activate(context: vscode.ExtensionContext) {
	console.log('PHP DAO Generator extension is now active!');

	// Initialize services
	const databaseService = new DatabaseService();
	const connectionManager = new ConnectionManager(context);
	const connectionProvider = new DatabaseConnectionProvider(connectionManager, databaseService);

	// Register tree data provider
	vscode.window.createTreeView('phpDaoConnections', {
		treeDataProvider: connectionProvider,
		showCollapseAll: true
	});

	// Register commands
	const addConnectionCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.addConnection',
		() => connectionProvider.addConnection()
	);

	const refreshConnectionsCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.refreshConnections',
		() => connectionProvider.refresh()
	);

	const editConnectionCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.editConnection',
		(item) => connectionProvider.editConnection(item)
	);

	const deleteConnectionCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.deleteConnection',
		(item) => connectionProvider.deleteConnection(item)
	);

	const connectCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.connect',
		(item) => connectionProvider.connectToDatabase(item)
	);

	const disconnectCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.disconnect',
		(item) => connectionProvider.disconnectFromDatabase(item)
	);

	const openTableSelectionCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.openTableSelection',
		(item) => connectionProvider.openTableSelection(item)
	);

	// Add to subscriptions
	context.subscriptions.push(
		addConnectionCommand,
		refreshConnectionsCommand,
		editConnectionCommand,
		deleteConnectionCommand,
		connectCommand,
		disconnectCommand,
		openTableSelectionCommand
	);

	// Cleanup on deactivation
	context.subscriptions.push({
		dispose: () => databaseService.disconnectAll()
	});
}

export function deactivate() {
	console.log('PHP DAO Generator extension is deactivated');
}