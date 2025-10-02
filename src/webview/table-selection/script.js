// Get the VS Code API
const vscode = acquireVsCodeApi();

// DOM elements
let tableList;
let selectedCount;
let generateBtn;
let selectAllBtn;
let selectNoneBtn;
let searchInput;
let clearSearchBtn;

// State
let tablesData = [];
let filteredTables = [];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
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
    searchInput = document.getElementById('searchInput');
    clearSearchBtn = document.getElementById('clearSearchBtn');
}

function setupEventListeners() {
    // Button event listeners
    selectAllBtn.addEventListener('click', selectAll);
    selectNoneBtn.addEventListener('click', selectNone);
    generateBtn.addEventListener('click', generateDao);
    
    // Search functionality
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Show/hide clear button based on input content
    searchInput.addEventListener('input', toggleClearButton);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

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
    filteredTables = tables; // Initially, no filter applied

    if (tables.length === 0) {
        tableList.innerHTML = '<div class="loading">Aucune table trouvée dans cette base de données.</div>';
        updateSelectedCount();
        return;
    }

    renderTables(filteredTables);
    updateSelectedCount();
}

function renderTables(tables) {
    if (tables.length === 0) {
        tableList.innerHTML = '<div class="loading">Aucune table ne correspond à votre recherche.</div>';
        return;
    }

    const tableItems = tables.map(table => `
        <div class="table-item" data-table="${escapeHtml(table)}">
            <label>
                <input type="checkbox" value="${escapeHtml(table)}">
                <i class="codicon codicon-table"></i>
                ${escapeHtml(table)}
            </label>
        </div>
    `).join('');

    tableList.innerHTML = tableItems;

    // Add event listeners to new checkboxes
    const checkboxes = tableList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectedCount);
    });
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

    selectedCount.innerHTML = `<i class="codicon codicon-info"></i> ${checkedCount} table(s) sélectionnée(s)`;
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

// Search functionality
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredTables = tablesData;
    } else {
        filteredTables = tablesData.filter(table => {
            // Remove common prefixes for better search
            const cleanTableName = removeCommonPrefixes(table.toLowerCase());
            return cleanTableName.includes(searchTerm) || table.toLowerCase().includes(searchTerm);
        });
    }
    
    renderTables(filteredTables);
    updateSelectedCount();
}

function removeCommonPrefixes(tableName) {
    // Detect common prefix dynamically from all tables
    const commonPrefix = detectCommonPrefix();
    
    if (commonPrefix && tableName.startsWith(commonPrefix)) {
        return tableName.substring(commonPrefix.length);
    }
    
    return tableName;
}

function detectCommonPrefix() {
    if (tablesData.length === 0) {
        return '';
    }
    
    // Find the longest common prefix ending with underscore
    let commonPrefix = '';
    
    // Start with the first table as reference
    const firstTable = tablesData[0].toLowerCase();
    
    // Look for underscore positions in the first table
    for (let i = 0; i < firstTable.length; i++) {
        if (firstTable[i] === '_') {
            const potentialPrefix = firstTable.substring(0, i + 1);
            
            // Check if this prefix is common to at least 70% of tables
            const tablesWithPrefix = tablesData.filter(table => 
                table.toLowerCase().startsWith(potentialPrefix)
            ).length;
            
            const percentage = tablesWithPrefix / tablesData.length;
            
            if (percentage >= 0.7) { // 70% threshold
                commonPrefix = potentialPrefix;
            }
        }
    }
    
    return commonPrefix;
}

function clearSearch() {
    searchInput.value = '';
    filteredTables = tablesData;
    renderTables(filteredTables);
    updateSelectedCount();
    toggleClearButton();
    searchInput.focus();
}

function toggleClearButton() {
    if (searchInput.value.trim() !== '') {
        clearSearchBtn.classList.add('visible');
    } else {
        clearSearchBtn.classList.remove('visible');
    }
}

// Keyboard shortcuts
function handleKeyboardShortcuts(event) {
    // Ctrl+F or Cmd+F to focus search
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
    }
    
    // Escape to clear search when search input is focused
    if (event.key === 'Escape' && document.activeElement === searchInput) {
        if (searchInput.value.trim() !== '') {
            clearSearch();
        } else {
            searchInput.blur();
        }
    }
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

    // Désélectionner toutes les tables après la génération
    selectNone();
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
    const searchTerm = searchInput.value;

    vscode.setState({
        selectedTables: selectedTables,
        mode: mode,
        tablesData: tablesData,
        searchTerm: searchTerm
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

    // Restore search term
    if (state.searchTerm) {
        searchInput.value = state.searchTerm;
        handleSearch();
        toggleClearButton();
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
