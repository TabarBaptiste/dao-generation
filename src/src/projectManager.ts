import * as vscode from 'vscode';


export class ProjectManager {
    private readonly fileName = '.dao-generator.json';


    private async getWorkspaceFolder(): Promise<vscode.Uri> {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) return folders[0].uri;
        const uri = await vscode.window.showOpenDialog({ canSelectFolders: true, openLabel: 'Choisir un dossier de workspace' });
        if (!uri || uri.length === 0) throw new Error('Aucun dossier sélectionné. Ouvrez un workspace ou choisissez un dossier.');
        return uri[0];
    }


    public async loadProjects(): Promise<any[]> {
        try {
            const folder = await this.getWorkspaceFolder();
            const fileUri = vscode.Uri.joinPath(folder, this.fileName);
            const raw = await vscode.workspace.fs.readFile(fileUri);
            const json = JSON.parse(Buffer.from(raw).toString('utf8'));
            return json.projects || [];
        } catch (e) {
            return [];
        }
    }


    public async saveProject(project: any): Promise<void> {
        const folder = await this.getWorkspaceFolder();
        const fileUri = vscode.Uri.joinPath(folder, this.fileName);
        let existing = { projects: [] as any[] };
        try {
            const raw = await vscode.workspace.fs.readFile(fileUri);
            existing = JSON.parse(Buffer.from(raw).toString('utf8'));
        } catch (e) {
            existing = { projects: [] };
        }
        existing.projects = existing.projects || [];
        const idx = existing.projects.findIndex((p: any) => p.name === project.name);
        if (idx >= 0) existing.projects[idx] = project;
        else existing.projects.push(project);


        const buffer = Buffer.from(JSON.stringify(existing, null, 2), 'utf8');
        await vscode.workspace.fs.writeFile(fileUri, buffer);
    }
}