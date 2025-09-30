import * as vscode from 'vscode';
import { DatabaseServeurProvider } from './providers/DatabaseConnectionProvider';
import { ServeurManager } from './services/ConnectionManager';
import { DatabaseService } from './services/DatabaseService';

export function activate(context: vscode.ExtensionContext) {
	console.log('PHP DAO Generator extension activated successfully!');
	// vscode.window.showInformationMessage('PHP DAO Generator extension activated successfully!');

	// Initialize services
	const databaseService = new DatabaseService();
	const serveurManager = new ServeurManager(context, databaseService);
	const connectionProvider = new DatabaseServeurProvider(serveurManager, databaseService, context.extensionUri);

	// Register tree data provider
	vscode.window.createTreeView('phpDaoServeurs', {
		treeDataProvider: connectionProvider,
		showCollapseAll: true
	});

	// Register commands
	const addServeurCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.addServeur',
		() => connectionProvider.addServeur()
	);

	const refreshServeursCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.refreshServeurs',
		() => connectionProvider.refresh()
	);

	const editServeurCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.editServeur',
		(item) => connectionProvider.editServeur(item)
	);

	const deleteServeurCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.deleteServeur',
		(item) => connectionProvider.deleteServeur(item)
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

	const exportServeursCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.exportServeurs',
		() => connectionProvider.exportServeurs()
	);

	const importServeursCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.importServeurs',
		() => connectionProvider.importServeurs()
	);

	const toggleSortCommand = vscode.commands.registerCommand(
		'phpDaoGenerator.toggleSort',
		() => connectionProvider.toggleSortMode()
	);

	// Add to subscriptions
	context.subscriptions.push(
		addServeurCommand,
		refreshServeursCommand,
		editServeurCommand,
		deleteServeurCommand,
		connectCommand,
		disconnectCommand,
		openTableSelectionCommand,
		exportServeursCommand,
		importServeursCommand,
		toggleSortCommand
	);

	// Cleanup on deactivation
	context.subscriptions.push({
		dispose: () => databaseService.disconnectAll()
	});
}

export function deactivate() {
	console.log('PHP DAO Generator extension is deactivated');
}