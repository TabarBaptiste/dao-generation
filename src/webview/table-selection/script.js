// Get the VS Code API
const vscode = acquireVsCodeApi();

// DOM elements
let tableList;
let selectedCount;
let generateBtn;
let selectAllBtn;
let selectNoneBtn;

// State
let tablesData = [];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    
    // Request initial data
    vscode.postMessage({ command: 'ready' });
});

function initializeElements() {
    tableList = document.getElementById('tableList');
    selectedCount = document.getElementById('selectedCount');
    generateBtn = document.getElementById('generateBtn');
    selectAllBtn = document.getElementById('selectAllBtn');
    selectNoneBtn = document.getElementById('selectNoneBtn');
}

function setupEventListeners() {
    // Button event listeners
    selectAllBtn.addEventListener('click', selectAll);
    selectNoneBtn.addEventListener('click', selectNone);
    generateBtn.addEventListener('click', generateDao);
    
    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateData':
                updatePageData(message.data);
                break;
            case 'updateTables':
                updateTablesList(message.tables);
                break;
            case 'showError':
                showError(message.error);
                break;
            case 'showLoading':
                showLoading();
                break;
        }
    });
}

function updatePageData(data) {
    // Update header information
    document.getElementById('databaseName').textContent = data.database;
    document.getElementById('hostName').textContent = data.host;
}

function updateTablesList(tables) {
    tablesData = tables;
    
    if (tables.length === 0) {
        tableList.innerHTML = '<div class="loading">Aucune table trouvée dans cette base de données.</div>';
        updateSelectedCount();
        return;
    }
    
    const tableItems = tables.map(table => `
        <div class="table-item">
            <label>
                <input type="checkbox" value="${escapeHtml(table)}"> ${escapeHtml(table)}
            </label>
        </div>
    `).join('');
    
    tableList.innerHTML = tableItems;
    
    // Add event listeners to new checkboxes
    const checkboxes = tableList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectedCount);
    });
    
    updateSelectedCount();
}

function showLoading() {
    tableList.innerHTML = '<div class="loading">Chargement des tables...</div>';
    generateBtn.disabled = true;
    selectAllBtn.disabled = false;
    selectNoneBtn.disabled = false;
}

function showError(errorMessage) {
    tableList.innerHTML = `
        <div class="error">
            <h3>Erreur</h3>
            <p>Impossible de récupérer les tables de la base de données.</p>
            <p><strong>Détail:</strong> ${escapeHtml(errorMessage)}</p>
        </div>
    `;
    generateBtn.disabled = true;
    selectAllBtn.disabled = true;
    selectNoneBtn.disabled = true;
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.table-item input[type="checkbox"]');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    
    selectedCount.textContent = `${checkedCount} table(s) sélectionnée(s)`;
    generateBtn.disabled = checkedCount === 0;
}

function selectAll() {
    const checkboxes = document.querySelectorAll('.table-item input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    updateSelectedCount();
}

function selectNone() {
    const checkboxes = document.querySelectorAll('.table-item input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    updateSelectedCount();
}

function generateDao() {
    const selectedTables = Array.from(document.querySelectorAll('.table-item input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    if (selectedTables.length === 0) {
        return;
    }
    
    vscode.postMessage({
        command: 'generate',
        selectedTables: selectedTables,
        mode: mode
    });
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Save and restore state
function saveState() {
    const checkboxes = document.querySelectorAll('.table-item input[type="checkbox"]');
    const selectedTables = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'save';
    
    vscode.setState({
        selectedTables: selectedTables,
        mode: mode,
        tablesData: tablesData
    });
}

function restoreState() {
    const state = vscode.getState();
    if (!state) return;
    
    // Restore mode selection
    if (state.mode) {
        const modeRadio = document.querySelector(`input[name="mode"][value="${state.mode}"]`);
        if (modeRadio) {
            modeRadio.checked = true;
        }
    }
    
    // Restore table selections
    if (state.selectedTables) {
        const checkboxes = document.querySelectorAll('.table-item input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = state.selectedTables.includes(cb.value);
        });
        updateSelectedCount();
    }
}

// Auto-save state when selections change
document.addEventListener('change', saveState);
