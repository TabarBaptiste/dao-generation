import * as vscode from 'vscode';

export class ProjectFormPanel {
    public static currentPanel: ProjectFormPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        this.panel.webview.html = this.getHtmlForWebview();
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.ViewColumn.Two;

        if (ProjectFormPanel.currentPanel) {
            ProjectFormPanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'daoProjectForm',
            'Nouvelle connexion BDD',
            column,
            { enableScripts: true }
        );

        ProjectFormPanel.currentPanel = new ProjectFormPanel(panel, extensionUri);
    }

    private getHtmlForWebview(): string {
        return /*html*/ `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouveau projet DAO</title>
        <style>
          body { font-family: sans-serif; padding: 1rem; }
          label { display: block; margin-top: 0.5rem; }
          input { width: 100%; padding: 0.4rem; margin-top: 0.2rem; }
          button { margin-top: 1rem; padding: 0.5rem 1rem; }
        </style>
      </head>
      <body>
        <h2>Ajouter une base de données</h2>
        <form id="projectForm">
          <label>Nom du projet
            <input type="text" id="projectName" required />
          </label>
          <label>Adresse du serveur
            <input type="text" id="host" placeholder="localhost" required />
          </label>
          <label>Port
            <input type="number" id="port" value="3306" required />
          </label>
          <label>Nom de la base
            <input type="text" id="database" required />
          </label>
          <label>Utilisateur
            <input type="text" id="user" required />
          </label>
          <label>Mot de passe
            <input type="password" id="password" />
          </label>
          <label>Répertoire du projet
            <input type="text" id="path" placeholder="D:\\wamp64\\www\\mon_projet" required />
          </label>
          <button type="submit">Enregistrer</button>
        </form>
      </body>
      </html>
    `;
    }
}
