import * as vscode from 'vscode';
import { DatabaseConnectionProvider } from './providers/DatabaseConnectionProvider';
import { ConnectionManager } from './services/ConnectionManager';

export function activate(context: vscode.ExtensionContext) {
	console.log('PHP DAO Generator extension is now active!');

	// Initialize services
	const connectionManager = new ConnectionManager(context);
	const connectionProvider = new DatabaseConnectionProvider(connectionManager);

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

	// Add to subscriptions
	context.subscriptions.push(
		addConnectionCommand,
		refreshConnectionsCommand,
		editConnectionCommand,
		deleteConnectionCommand
	);
}

export function deactivate() {
	console.log('PHP DAO Generator extension is deactivated');
}