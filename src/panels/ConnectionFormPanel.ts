import * as vscode from 'vscode';
import { ConnectionFormData } from '../types/Connection';
import { DatabaseService } from '../services/DatabaseService';

export class ConnectionFormPanel {
    private databaseService = new DatabaseService();
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
            this.panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'submit':
                        resolve(message.data);
                        this.panel?.dispose();
                        break;
                    case 'cancel':
                        resolve(undefined);
                        this.panel?.dispose();
                        break;
                    case 'testConnection':
                        await this.handleTestConnection(message.data);
                        break;
                    case 'loadDatabases':
                        await this.handleLoadDatabases(message.data);
                        break;
                }
            });

            this.panel.onDidDispose(() => {
                resolve(undefined);
            });
        });
    }

    private async handleTestConnection(data: any): Promise<void> {
        try {
            const connectionData = {
                id: 'temp',
                name: data.name,
                host: data.host,
                port: parseInt(data.port),
                username: data.username,
                password: data.password,
                database: data.database,
                type: data.type as 'mysql' | 'mariadb'
            };

            const success = await this.databaseService.testConnection(connectionData);
            
            this.panel?.webview.postMessage({
                command: 'testConnectionResult',
                success,
                message: success ? 'Connection successful!' : 'Connection failed. Please check your credentials.'
            });
        } catch (error) {
            this.panel?.webview.postMessage({
                command: 'testConnectionResult',
                success: false,
                message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async handleLoadDatabases(data: any): Promise<void> {
        try {
            const connectionData = {
                id: 'temp',
                name: data.name,
                host: data.host,
                port: parseInt(data.port),
                username: data.username,
                password: data.password,
                type: data.type as 'mysql' | 'mariadb'
            };

            const databases = await this.databaseService.getDatabases(connectionData);
            
            this.panel?.webview.postMessage({
                command: 'databasesLoaded',
                databases
            });
        } catch (error) {
            this.panel?.webview.postMessage({
                command: 'databasesLoaded',
                databases: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
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
        
        .database-input-group {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .database-input-group select {
            flex: 1;
        }
        
        .btn-load-db {
            padding: 8px 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
            width: 35px;
            height: 35px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .btn-load-db:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .btn-load-db:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .test-connection {
            margin-bottom: 20px;
        }
        
        .btn-test {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 6px 12px;
            font-size: 12px;
        }
        
        .btn-test:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .status-message {
            margin-top: 10px;
            padding: 8px 12px;
            border-radius: 2px;
            font-size: 12px;
        }
        
        .status-success {
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            color: var(--vscode-inputValidation-infoForeground);
        }
        
        .status-error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
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
                <div class="database-input-group">
                    <select id="database" name="database">
                        <option value="">Select a database...</option>
                    </select>
                    <button type="button" id="loadDbBtn" class="btn-load-db" title="Load databases">🔄</button>
                </div>
                <div class="help-text">Click the refresh button to load available databases</div>
            </div>
            
            <div class="test-connection">
                <button type="button" id="testBtn" class="btn-test">Test Connection</button>
                <div id="statusMessage" class="status-message" style="display: none;"></div>
            </div>
            
            <div class="buttons">
                <button type="button" class="btn-secondary" onclick="cancel()">Cancel</button>
                <button type="submit" class="btn-primary">${existingData ? 'Update' : 'Create'}</button>
            </div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let availableDatabases = [];
        
        // Event listeners
        document.getElementById('connectionForm').addEventListener('submit', handleSubmit);
        document.getElementById('testBtn').addEventListener('click', testConnection);
        document.getElementById('loadDbBtn').addEventListener('click', loadDatabases);
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'testConnectionResult':
                    handleTestResult(message.success, message.message);
                    break;
                case 'databasesLoaded':
                    handleDatabasesLoaded(message.databases, message.error);
                    break;
            }
        });
        
        function handleSubmit(e) {
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
                showStatus('Please fill in all required fields', false);
                return;
            }
            
            vscode.postMessage({
                command: 'submit',
                data: data
            });
        }
        
        function testConnection() {
            const data = getFormData();
            if (!validateRequiredFields(data)) {
                showStatus('Please fill in all required fields first', false);
                return;
            }
            
            const testBtn = document.getElementById('testBtn');
            testBtn.textContent = 'Testing...';
            testBtn.disabled = true;
            
            vscode.postMessage({
                command: 'testConnection',
                data: data
            });
        }
        
        function loadDatabases() {
            const data = getFormData();
            if (!validateRequiredFields(data)) {
                showStatus('Please fill in connection details first', false);
                return;
            }
            
            const loadBtn = document.getElementById('loadDbBtn');
            loadBtn.textContent = '⏳';
            loadBtn.disabled = true;
            
            vscode.postMessage({
                command: 'loadDatabases',
                data: data
            });
        }
        
        function handleTestResult(success, message) {
            const testBtn = document.getElementById('testBtn');
            testBtn.textContent = 'Test Connection';
            testBtn.disabled = false;
            
            showStatus(message, success);
        }
        
        function handleDatabasesLoaded(databases, error) {
            const loadBtn = document.getElementById('loadDbBtn');
            const databaseSelect = document.getElementById('database');
            
            loadBtn.textContent = '🔄';
            loadBtn.disabled = false;
            
            if (error) {
                showStatus('Failed to load databases: ' + error, false);
                return;
            }
            
            // Clear existing options except the first one
            databaseSelect.innerHTML = '<option value="">Select a database...</option>';
            
            // Add database options
            databases.forEach(db => {
                const option = document.createElement('option');
                option.value = db;
                option.textContent = db;
                databaseSelect.appendChild(option);
            });
            
            // Set selected value if it was previously selected
            const currentValue = '${data.database}';
            if (currentValue && databases.includes(currentValue)) {
                databaseSelect.value = currentValue;
            }
            
            availableDatabases = databases;
            showStatus(\`Loaded \${databases.length} database(s)\`, true);
        }
        
        function getFormData() {
            return {
                name: document.getElementById('name').value,
                type: document.getElementById('type').value,
                host: document.getElementById('host').value,
                port: document.getElementById('port').value,
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                database: document.getElementById('database').value
            };
        }
        
        function validateRequiredFields(data) {
            return data.name && data.host && data.port && data.username && data.password;
        }
        
        function showStatus(message, isSuccess) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.textContent = message;
            statusDiv.className = 'status-message ' + (isSuccess ? 'status-success' : 'status-error');
            statusDiv.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
        
        function cancel() {
            vscode.postMessage({
                command: 'cancel'
            });
        }
        
        // Focus on first input
        document.getElementById('name').focus();
        
        // Pre-select database if editing
        const preselectedDb = '${data.database}';
        if (preselectedDb) {
            document.getElementById('database').innerHTML += \`<option value="\${preselectedDb}" selected>\${preselectedDb}</option>\`;
        }
    </script>
</body>
</html>`;
    }
}