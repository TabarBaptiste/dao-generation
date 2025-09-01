import * as vscode from 'vscode';
import { ConnectionFormData } from '../types/Connection';

export class ConnectionFormPanel {
    private panel: vscode.WebviewPanel | undefined;

    public async show(existingData?: ConnectionFormData): Promise<ConnectionFormData | undefined> {
        return new Promise((resolve) => {
            this.panel = vscode.window.createWebviewPanel(
                'connectionForm',
                existingData ? 'Edit Database Connection' : 'Add Database Connection',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.webview.html = this.getWebviewContent(existingData);

            // Handle messages from the webview
            this.panel.webview.onDidReceiveMessage((message) => {
                switch (message.command) {
                    case 'submit':
                        resolve(message.data);
                        this.panel?.dispose();
                        break;
                    case 'cancel':
                        resolve(undefined);
                        this.panel?.dispose();
                        break;
                }
            });

            this.panel.onDidDispose(() => {
                resolve(undefined);
            });
        });
    }

    private getWebviewContent(existingData?: ConnectionFormData): string {
        const data = existingData || {
            name: '',
            host: 'localhost',
            port: '3306',
            username: '',
            password: '',
            database: '',
            type: 'mysql' as const
        };

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Connection</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            margin: 0;
        }
        
        .container {
            max-width: 500px;
            margin: 0 auto;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        
        input, select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-size: 13px;
            box-sizing: border-box;
        }
        
        input:focus, select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .required {
            color: var(--vscode-errorForeground);
        }
        
        .form-row {
            display: flex;
            gap: 15px;
        }
        
        .form-row .form-group {
            flex: 1;
        }
        
        .buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            min-width: 80px;
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        h1 {
            color: var(--vscode-foreground);
            margin-bottom: 30px;
            font-size: 18px;
            font-weight: normal;
        }
        
        .help-text {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        
        .icon {
            display: inline-block;
            width: 16px;
            height: 16px;
            margin-right: 8px;
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>
            <span class="icon">🗄️</span>
            ${existingData ? 'Edit Database Connection' : 'New Database Connection'}
        </h1>
        
        <form id="connectionForm">
            <div class="form-group">
                <label for="name">Connection Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" value="${data.name}" required>
                <div class="help-text">A friendly name to identify this connection</div>
            </div>
            
            <div class="form-group">
                <label for="type">Database Type <span class="required">*</span></label>
                <select id="type" name="type" required>
                    <option value="mysql" ${data.type === 'mysql' ? 'selected' : ''}>MySQL</option>
                    <option value="mariadb" ${data.type === 'mariadb' ? 'selected' : ''}>MariaDB</option>
                </select>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="host">Host <span class="required">*</span></label>
                    <input type="text" id="host" name="host" value="${data.host}" required>
                </div>
                
                <div class="form-group">
                    <label for="port">Port <span class="required">*</span></label>
                    <input type="number" id="port" name="port" value="${data.port}" min="1" max="65535" required>
                </div>
            </div>
            
            <div class="form-group">
                <label for="username">Username <span class="required">*</span></label>
                <input type="text" id="username" name="username" value="${data.username}" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password <span class="required">*</span></label>
                <input type="password" id="password" name="password" value="${data.password}" required>
            </div>
            
            <div class="form-group">
                <label for="database">Database</label>
                <input type="text" id="database" name="database" value="${data.database}">
                <div class="help-text">Optional - Leave empty to see all databases</div>
            </div>
            
            <div class="buttons">
                <button type="button" class="btn-secondary" onclick="cancel()">Cancel</button>
                <button type="submit" class="btn-primary">${existingData ? 'Update' : 'Create'}</button>
            </div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('connectionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = {
                name: formData.get('name'),
                type: formData.get('type'),
                host: formData.get('host'),
                port: formData.get('port'),
                username: formData.get('username'),
                password: formData.get('password'),
                database: formData.get('database')
            };
            
            // Basic validation
            if (!data.name || !data.host || !data.port || !data.username || !data.password) {
                alert('Please fill in all required fields');
                return;
            }
            
            vscode.postMessage({
                command: 'submit',
                data: data
            });
        });
        
        function cancel() {
            vscode.postMessage({
                command: 'cancel'
            });
        }
        
        // Focus on first input
        document.getElementById('name').focus();
    </script>
</body>
</html>`;
    }
}