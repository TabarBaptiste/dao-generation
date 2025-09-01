import * as vscode from 'vscode';
import { ProjectManager } from './src/projectManager';
import { ProjectTreeProvider } from './src/projectTreeProvider';
import { ProjectFormPanel } from './src/projectFormPanel';

export function activate(context: vscode.ExtensionContext) {
	const projectManager = new ProjectManager();

	// Tree view (gauche)
	const treeProvider = new ProjectTreeProvider(projectManager);
	vscode.window.registerTreeDataProvider('daoProjectsView', treeProvider);

	// Commande pour ouvrir le formulaire (droite)
	const disposable = vscode.commands.registerCommand('daoGenerator.newProject', () => {
		ProjectFormPanel.createOrShow(context.extensionUri);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
