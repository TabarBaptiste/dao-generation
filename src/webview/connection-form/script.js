// Get the VS Code API
const vscode = acquireVsCodeApi();

// State
let availableDatabases = [];
let isEditMode = false;
let autoLoadTimeout = null; // Timer pour le rechargement automatique
let lastConnectionData = null; // Stockage des dernières données de connexion

// DOM elements
let formElements = {};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    
    // Request initial data
    vscode.postMessage({ command: 'ready' });
    
    // Focus on first input
    formElements.name.focus();
});

function initializeElements() {
    formElements = {
        form: document.getElementById('connectionForm'),
        formTitle: document.getElementById('formTitle'),
        name: document.getElementById('name'),
        type: document.getElementById('type'),
        host: document.getElementById('host'),
        port: document.getElementById('port'),
        username: document.getElementById('username'),
        password: document.getElementById('password'),
        database: document.getElementById('database'),
        testBtn: document.getElementById('testBtn'),
        loadDbBtn: document.getElementById('loadDbBtn'),
        cancelBtn: document.getElementById('cancelBtn'),
        submitBtn: document.getElementById('submitBtn'),
        statusMessage: document.getElementById('statusMessage')
    };
}

function setupEventListeners() {
    // Form submission
    formElements.form.addEventListener('submit', handleSubmit);
    
    // Button event listeners
    formElements.testBtn.addEventListener('click', testConnection);
    formElements.loadDbBtn.addEventListener('click', loadDatabases);
    formElements.cancelBtn.addEventListener('click', cancel);
    
    // Prevent exponential notation in port field
    formElements.port.addEventListener('keydown', function(e) {
        // Block e, E, +, - keys
        if (['e', 'E', '+', '-'].includes(e.key)) {
            e.preventDefault();
        }
    });
    
    formElements.port.addEventListener('input', function(e) {
        // Remove any exponential notation characters that might have been pasted
        e.target.value = e.target.value.replace(/[eE\+\-]/g, '');
    });
    
    // Auto-generate connection name based on host and database
    formElements.host.addEventListener('input', updateConnectionName);
    formElements.database.addEventListener('change', updateConnectionName);
    
    // Auto-load databases when all required fields are filled
    formElements.host.addEventListener('input', scheduleAutoLoadDatabases);
    formElements.port.addEventListener('input', scheduleAutoLoadDatabases);
    formElements.username.addEventListener('input', scheduleAutoLoadDatabases);
    formElements.password.addEventListener('input', scheduleAutoLoadDatabases);
    formElements.type.addEventListener('change', scheduleAutoLoadDatabases);
    
    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'loadData':
                loadFormData(message.data, message.isEdit);
                break;
            case 'testConnectionResult':
                handleTestResult(message.success, message.message);
                break;
            case 'databasesLoaded':
                handleDatabasesLoaded(message.databases, message.error);
                break;
        }
    });
}

function loadFormData(data, editMode = false) {
    isEditMode = editMode;
    
    // Update form title and button
    formElements.formTitle.textContent = editMode ? 'Edit Database Connection' : 'New Database Connection';
    formElements.submitBtn.textContent = editMode ? 'Update' : 'Create';
    
    // Populate form fields
    if (data) {
        formElements.name.value = data.name || '';
        formElements.type.value = data.type || 'mysql';
        formElements.host.value = data.host || 'localhost';
        formElements.port.value = data.port || '3306';
        formElements.username.value = data.username || '';
        formElements.password.value = data.password || '';
        
        // Handle database selection
        if (data.database) {
            const option = document.createElement('option');
            option.value = data.database;
            option.textContent = data.database;
            option.selected = true;
            formElements.database.appendChild(option);
        }
    }
}

function handleSubmit(e) {
    e.preventDefault();
    
    const formData = getFormData();
    
    // Basic validation
    if (!validateRequiredFields(formData)) {
        showStatus('Please fill in all required fields', false);
        return;
    }
    
    vscode.postMessage({
        command: 'submit',
        data: formData
    });
}

function testConnection() {
    const data = getFormData();
    if (!validateRequiredFields(data)) {
        showStatus('Please fill in all required fields first', false);
        return;
    }
    
    setButtonLoading(formElements.testBtn, true, 'Testing...');
    
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
    
    setButtonLoading(formElements.loadDbBtn, true, '⏳');
    formElements.loadDbBtn.classList.add('spinning');
    
    vscode.postMessage({
        command: 'loadDatabases',
        data: data
    });
}

function handleTestResult(success, message) {
    setButtonLoading(formElements.testBtn, false, 'Test Connection');
    showStatus(message, success);
}

function handleDatabasesLoaded(databases, error) {
    setButtonLoading(formElements.loadDbBtn, false, '🔄');
    formElements.loadDbBtn.classList.remove('spinning');
    
    if (error) {
        showStatus('Failed to load databases: ' + error, false);
        return;
    }
    
    // Clear existing options except the first one
    formElements.database.innerHTML = '<option value="">Select a database...</option>';
    
    // Add database options
    databases.forEach(db => {
        const option = document.createElement('option');
        option.value = db;
        option.textContent = db;
        formElements.database.appendChild(option);
    });
    
    availableDatabases = databases;
    
    // Message différent selon si c'est un chargement automatique ou manuel
    const isAutoLoad = autoLoadTimeout === null && databases.length > 0;
    const message = isAutoLoad 
        ? `${databases.length} database(s) loaded automatically` 
        : `Loaded ${databases.length} database(s)`;
    
    showStatus(message, true);
    
    // Update connection name if field is empty
    updateConnectionName();
}

function getFormData() {
    return {
        name: formElements.name.value.trim(),
        type: formElements.type.value,
        host: formElements.host.value.trim(),
        port: parseInt(formElements.port.value, 10),
        username: formElements.username.value.trim(),
        password: formElements.password.value,
        database: formElements.database.value
    };
}

function validateRequiredFields(data) {
    return data.name && data.host && data.port && !isNaN(data.port) && data.port > 0 && data.port <= 65535 && data.username && data.password;
}

function validateConnectionFields(data) {
    return data.host && data.port && !isNaN(data.port) && data.port > 0 && data.port <= 65535 && data.username && data.password;
}

function showStatus(message, isSuccess) {
    const statusDiv = formElements.statusMessage;
    statusDiv.textContent = message;
    statusDiv.className = 'status-message ' + (isSuccess ? 'status-success' : 'status-error');
    statusDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

function setButtonLoading(button, loading, text) {
    if (loading) {
        button.disabled = true;
        button.textContent = text;
        button.classList.add('loading');
    } else {
        button.disabled = false;
        button.textContent = text;
        button.classList.remove('loading');
    }
}

function cancel() {
    // Nettoyer le timeout avant de fermer
    if (autoLoadTimeout) {
        clearTimeout(autoLoadTimeout);
        autoLoadTimeout = null;
    }
    
    vscode.postMessage({
        command: 'cancel'
    });
}

// Auto-generate connection name based on host and database
function updateConnectionName() {
    // if (formElements.name.value.trim() === '') {
        const host = formElements.host.value.trim();
        const database = formElements.database.value.trim();
        
        if (host) {
            if (database) {
                formElements.name.value = `${host}.${database}`;
            } else {
                formElements.name.value = host;
            }
        } else {
            formElements.name.value = '';
        }
    // }
}

/**
 * Planifie le rechargement automatique des bases de données
 */
function scheduleAutoLoadDatabases() {
    // Annuler le timer précédent s'il existe
    if (autoLoadTimeout) {
        clearTimeout(autoLoadTimeout);
        autoLoadTimeout = null;
    }
    
    // Vérifier si tous les champs requis pour la connexion sont remplis
    const data = getFormData();
    const hasRequiredConnectionFields = validateConnectionFields(data);
    
    if (hasRequiredConnectionFields) {
        // Vérifier si les données de connexion ont changé
        const currentConnectionData = {
            host: data.host,
            port: data.port,
            username: data.username,
            password: data.password,
            type: data.type
        };
        
        const connectionDataChanged = !lastConnectionData || 
            JSON.stringify(currentConnectionData) !== JSON.stringify(lastConnectionData);
        
        if (connectionDataChanged) {
            // Programmer le rechargement automatique après 1.5 secondes
            autoLoadTimeout = setTimeout(() => {
                // Vérifier une dernière fois que les champs sont toujours remplis
                const finalData = getFormData();
                
                if (validateConnectionFields(finalData)) {
                    // Éviter de recharger si le bouton est déjà en cours de chargement
                    if (!formElements.loadDbBtn.disabled) {
                        console.log('Auto-loading databases...');
                        loadDatabasesAuto();
                    }
                }
                autoLoadTimeout = null;
            }, 1500); // 1.5 secondes de délai
            
            // Sauvegarder les nouvelles données de connexion
            lastConnectionData = currentConnectionData;
        }
    } else {
        // Si les champs requis ne sont pas remplis, réinitialiser
        lastConnectionData = null;
    }
}

/**
 * Charge les bases de données automatiquement (version silencieuse)
 */
function loadDatabasesAuto() {
    const data = getFormData();
    
    // Validation finale avant le chargement
    if (!validateConnectionFields(data)) {
        return;
    }
    
    // Indiquer visuellement que le chargement automatique est en cours
    setButtonLoading(formElements.loadDbBtn, true, '⏳');
    formElements.loadDbBtn.classList.add('spinning');
    
    // Afficher un message discret
    showStatus('Loading databases automatically...', true);
    
    vscode.postMessage({
        command: 'loadDatabases',
        data: data
    });
}

// Form validation helpers
function validateForm() {
    const data = getFormData();
    const isValid = validateRequiredFields(data);
    formElements.submitBtn.disabled = !isValid;
    return isValid;
}

// Add real-time validation
document.addEventListener('input', function() {
    validateForm();
});

// Save and restore state
function saveState() {
    const data = getFormData();
    vscode.setState({
        formData: data,
        isEditMode: isEditMode,
        availableDatabases: availableDatabases
    });
}

function restoreState() {
    const state = vscode.getState();
    if (!state) return;
    
    if (state.formData) {
        loadFormData(state.formData, state.isEditMode);
    }
    
    if (state.availableDatabases) {
        availableDatabases = state.availableDatabases;
        // Restore database options
        const currentDatabase = formElements.database.value;
        formElements.database.innerHTML = '<option value="">Select a database...</option>';
        state.availableDatabases.forEach(db => {
            const option = document.createElement('option');
            option.value = db;
            option.textContent = db;
            if (db === currentDatabase) {
                option.selected = true;
            }
            formElements.database.appendChild(option);
        });
    }
}

// Auto-save state when form changes
document.addEventListener('change', saveState);
document.addEventListener('input', saveState);

// Restore state on load
restoreState();

// Nettoyer les timers lors de la fermeture de la fenêtre
window.addEventListener('beforeunload', function() {
    if (autoLoadTimeout) {
        clearTimeout(autoLoadTimeout);
        autoLoadTimeout = null;
    }
});