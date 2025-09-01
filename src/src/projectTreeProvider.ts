import * as vscode from 'vscode';
import { ProjectManager } from './projectManager';

export class ProjectTreeProvider implements vscode.TreeDataProvider<string> {
    private _onDidChangeTreeData: vscode.EventEmitter<string | undefined | void> =
        new vscode.EventEmitter<string | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<string | undefined | void> =
        this._onDidChangeTreeData.event;

    constructor(private projectManager: ProjectManager) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: string): vscode.TreeItem {
        return {
            label: element,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
        };
    }

    getChildren(): string[] {
        return this.projectManager.listProjects();
    }
}
