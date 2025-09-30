// Récupération de l'API VS Code
const vscode = acquireVsCodeApi();

// État
let availableDatabases = [];
let isEditMode = false;
let autoLoadTimeout = null;
let lastServeurData = null;

// Éléments DOM
let formElements = {};

// Initialisation quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function () {
    initializeElements();
    setupEventListeners();

    // Demander les données initiales
    vscode.postMessage({ command: 'ready' });

    // Focus sur le premier champ
    formElements.name.focus();
});

function initializeElements() {
    formElements = {
        form: document.getElementById('serveurForm'),
        formTitle: document.getElementById('formTitle'),
        name: document.getElementById('name'),
        type: document.getElementById('type'),
        host: document.getElementById('host'),
        port: document.getElementById('port'),
        username: document.getElementById('username'),
        password: document.getElementById('password'),
        database: document.getElementById('database'),
        defaultDaoPath: document.getElementById('defaultDaoPath'),
        testBtn: document.getElementById('testBtn'),
        loadDbBtn: document.getElementById('loadDbBtn'),
        selectPathBtn: document.getElementById('selectPathBtn'),
        togglePasswordBtn: document.getElementById('togglePasswordBtn'),
        cancelBtn: document.getElementById('cancelBtn'),
        submitBtn: document.getElementById('submitBtn'),
        statusMessage: document.getElementById('statusMessage')
    };
}

function setupEventListeners() {
    // Soumission du formulaire
    formElements.form.addEventListener('submit', handleSubmit);

    // Écouteurs d'événements des boutons
    formElements.testBtn.addEventListener('click', () => performServeurTest(false));
    formElements.loadDbBtn.addEventListener('click', () => performServeurTest(true, false));
    formElements.selectPathBtn.addEventListener('click', selectDefaultPath);
    formElements.togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    formElements.cancelBtn.addEventListener('click', cancel);

    // Empêcher la notation exponentielle dans le champ port
    formElements.port.addEventListener('keydown', function (e) {
        if (['e', 'E', '+', '-'].includes(e.key)) {
            e.preventDefault();
        }
    });

    formElements.port.addEventListener('input', function (e) {
        e.target.value = e.target.value.replace(/[eE\+\-]/g, '');
    });

    // Auto-génération du nom de serveur basé sur l'hôte et la base de données
    formElements.host.addEventListener('input', updateServeurName);
    formElements.database.addEventListener('change', function() {
        updateServeurName();
        toggleDaoPathVisibility();
    });

    // Chargement automatique des bases de données quand tous les champs requis sont remplis
    ['host', 'port', 'username', 'password'].forEach(field => {
        formElements[field].addEventListener('input', scheduleAutoLoadDatabases);
    });
    formElements.type.addEventListener('change', scheduleAutoLoadDatabases);

    // Écouter les messages de l'extension
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'loadData':
                loadFormData(message.data, message.isEdit, message.titles, message.buttonLabels);
                break;
            case 'testConnectionResult':
                handleTestResult(message.success, message.message);
                break;
            case 'databasesLoaded':
                handleDatabasesLoaded(message.databases, message.success, message.message, message.isAutoLoad);
                break;
            case 'pathSelected':
                handlePathSelected(message.path);
                break;
        }
    });
}

function loadFormData(data, editMode = false, titles = null, buttonLabels = null) {
    isEditMode = editMode;

    // Mettre à jour le titre du formulaire en utilisant les constantes si fournies, sinon utiliser des chaînes codées en dur
    const addTitle = titles.add;
    const editTitle = titles.edit;

    formElements.formTitle.textContent = editMode ? editTitle : addTitle;

    // Mettre à jour l'icône du titre selon le mode
    const titleIcon = document.getElementById('titleIcon');
    if (titleIcon) {
        titleIcon.className = editMode ? 'codicon codicon-edit' : 'codicon codicon-add';
    }

    // Mettre à jour le texte des boutons en utilisant les constantes si fournies, sinon utiliser des chaînes codées en dur
    const createLabel = buttonLabels.create;
    const updateLabel = buttonLabels.update;

    setButtonTextWithIcon(formElements.submitBtn, editMode ? updateLabel : createLabel, editMode ? 'codicon-sync' : 'codicon-check');

    // Remplir les champs du formulaire
    if (data) {
        formElements.name.value = data.name || '';
        formElements.type.value = data.type || 'mysql';
        formElements.host.value = data.host || 'localhost';
        formElements.port.value = data.port || '3306';
        formElements.username.value = data.username || '';
        formElements.password.value = data.password || '';
        formElements.defaultDaoPath.value = data.defaultDaoPath || '';

        // Gérer la sélection de base de données
        if (data.database) {
            const option = document.createElement('option');
            option.value = data.database;
            option.textContent = data.database;
            option.selected = true;
            formElements.database.appendChild(option);
        }
        
        // Mettre à jour la visibilité du champ de répertoire par défaut
        toggleDaoPathVisibility();
    }
}

function handleSubmit(e) {
    e.preventDefault();

    const formData = getFormData();

    if (!validateRequiredFields(formData)) {
        showStatus('Veuillez remplir tous les champs obligatoires', false);
        return;
    }

    vscode.postMessage({
        command: 'submit',
        data: formData
    });
}

/**
 * Fonction commune de test de connexion
 * @param {boolean} loadDatabasesAfterTest - Si true, charge les BDD après le test
 * @param {boolean} isAutoLoad - Si true, c'est un chargement automatique
 */
function performServeurTest(loadDatabasesAfterTest = false, isAutoLoad = false) {
    const data = getFormData();

    // Validation selon le type de test
    const validationFn = loadDatabasesAfterTest ? validateServeurFields : validateRequiredFields;
    const errorMessage = loadDatabasesAfterTest
        ? 'Veuillez d\'abord remplir les détails du serveur'
        : 'Veuillez d\'abord remplir tous les champs obligatoires';

    if (!validationFn(data)) {
        if (!isAutoLoad) { // Ne pas afficher d'erreur pour l'auto-load
            showStatus(errorMessage, false);
        }
        return;
    }

    if (loadDatabasesAfterTest) {
        // Configuration pour le chargement de BDD
        setIconButtonLoading(formElements.loadDbBtn, true, 'codicon-sync', 'spin');
        formElements.loadDbBtn.classList.add('spinning');

        if (!isAutoLoad) {
            showStatus('Chargement des bases de données...', true);
        }

        vscode.postMessage({
            command: 'loadDatabases',
            data: data,
            isAutoLoad: isAutoLoad
        });
    } else {
        // Configuration pour le test simple
        setButtonLoading(formElements.testBtn, true, 'Test en cours...');

        vscode.postMessage({
            command: 'testConnection',
            data: data
        });
    }
}

function handleTestResult(success, message) {
    setButtonLoading(formElements.testBtn, false, 'Test Serveur');
    showStatus(message, success);
}

function handleDatabasesLoaded(databases, success, message, isAutoLoad = false) {
    setIconButtonLoading(formElements.loadDbBtn, false, 'codicon-refresh');
    formElements.loadDbBtn.classList.remove('spinning');

    if (!success) {
        formElements.database.innerHTML = '<option value="">Sélectionner une base de données...</option>';
        availableDatabases = [];
        showStatus(message, false);
        return;
    }

    // Effacer les options existantes sauf la première
    formElements.database.innerHTML = '<option value="">Sélectionner une base de données...</option>';

    // Ajouter les options de base de données
    databases.forEach(db => {
        const option = document.createElement('option');
        option.value = db;
        option.textContent = db;
        formElements.database.appendChild(option);
    });

    availableDatabases = databases;

    // Afficher le message approprié
    showStatus(message, true);

    // Mettre à jour le nom du serveur si le champ est vide
    updateServeurName();
    
    // Mettre à jour la visibilité du champ de répertoire par défaut
    toggleDaoPathVisibility();
}

function getFormData() {
    return {
        name: formElements.name.value.trim(),
        type: formElements.type.value,
        host: formElements.host.value.trim(),
        port: parseInt(formElements.port.value, 10),
        username: formElements.username.value.trim(),
        password: formElements.password.value,
        database: formElements.database.value,
        defaultDaoPath: formElements.defaultDaoPath.value.trim()
    };
}

function validateRequiredFields(data) {
    return data.name && data.host && data.port && !isNaN(data.port) &&
        data.port > 0 && data.port <= 65535 && data.username;
}

function validateServeurFields(data) {
    return data.host && data.port && !isNaN(data.port) &&
        data.port > 0 && data.port <= 65535 && data.username;
}

function showStatus(message, isSuccess) {
    const statusDiv = formElements.statusMessage;
    statusDiv.textContent = message;
    statusDiv.className = 'status-message ' + (isSuccess ? 'status-success' : 'status-error');
    statusDiv.style.display = 'block';

    // Masquer automatiquement après 5 secondes
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

function setIconButtonLoading(button, loading, iconClass, animationClass = null) {
    const icon = button.querySelector('i');
    if (loading) {
        button.disabled = true;
        icon.className = `codicon ${iconClass}`;
        if (animationClass) {
            icon.classList.add(animationClass);
        }
        button.classList.add('loading');
    } else {
        button.disabled = false;
        icon.className = `codicon ${iconClass}`;
        if (animationClass) {
            icon.classList.remove(animationClass);
        }
        button.classList.remove('loading');
    }
}

function setButtonTextWithIcon(button, text, iconClass) {
    button.innerHTML = `<i class="codicon ${iconClass}"></i> ${text}`;
}

function cancel() {
    if (autoLoadTimeout) {
        clearTimeout(autoLoadTimeout);
        autoLoadTimeout = null;
    }

    vscode.postMessage({
        command: 'cancel'
    });
}

// Fonction pour afficher/masquer le champ du répertoire par défaut
function toggleDaoPathVisibility() {
    const daoPathGroup = document.getElementById('defaultDaoPathGroup');
    const databaseValue = formElements.database.value.trim();
    
    if (databaseValue) {
        daoPathGroup.classList.add('show');
    } else {
        daoPathGroup.classList.remove('show');
        // Vider le champ si on masque le groupe
        formElements.defaultDaoPath.value = '';
    }
}

// Fonction pour demander la sélection d'un dossier
function selectDefaultPath() {
    vscode.postMessage({
        command: 'selectPath'
    });
}

// Fonction pour traiter le dossier sélectionné
function handlePathSelected(path) {
    if (path) {
        formElements.defaultDaoPath.value = path;
        // Déclencher l'événement change pour la sauvegarde automatique
        formElements.defaultDaoPath.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function updateServeurName() {
    const host = formElements.host.value.trim();
    const database = formElements.database.value.trim();

    if (host) {
        formElements.name.value = database ? `${host}.${database}` : host;
    } else {
        formElements.name.value = '';
    }
}

function scheduleAutoLoadDatabases() {
    // Annuler le timer précédent s'il existe
    if (autoLoadTimeout) {
        clearTimeout(autoLoadTimeout);
        autoLoadTimeout = null;
    }

    const data = getFormData();
    const hasRequiredServeurFields = validateServeurFields(data);

    if (hasRequiredServeurFields) {
        const currentServeurData = {
            host: data.host,
            port: data.port,
            username: data.username,
            password: data.password,
            type: data.type
        };

        const connectionDataChanged = !lastServeurData ||
            JSON.stringify(currentServeurData) !== JSON.stringify(lastServeurData);

        if (connectionDataChanged) {
            autoLoadTimeout = setTimeout(() => {
                performServeurTest(true, true); // Test + chargement BDD en auto-load
                autoLoadTimeout = null;
            }, 1500);

            lastServeurData = currentServeurData;
        }
    } else {
        lastServeurData = null;
    }
}

// Aides à la validation du formulaire
function validateForm() {
    const data = getFormData();
    const isValid = validateRequiredFields(data);
    formElements.submitBtn.disabled = !isValid;
    return isValid;
}

// Ajouter une validation en temps réel
document.addEventListener('input', validateForm);

// Gestion de l'état
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
        loadFormData(state.formData, state.isEditMode, null);
    }

    if (state.availableDatabases) {
        availableDatabases = state.availableDatabases;
        const currentDatabase = formElements.database.value;
        formElements.database.innerHTML = '<option value="">Sélectionner une base de données...</option>';
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

function togglePasswordVisibility() {
    const passwordInput = formElements.password;
    const toggleBtn = formElements.togglePasswordBtn;
    const icon = toggleBtn.querySelector('i');

    if (passwordInput.type === 'password') {
        // Afficher le mot de passe
        passwordInput.type = 'text';
        icon.className = 'codicon codicon-eye-closed'; // Changer l'icône pour "masquer"
        toggleBtn.title = 'Masquer le mot de passe';
    } else {
        // Masquer le mot de passe
        passwordInput.type = 'password';
        icon.className = 'codicon codicon-eye'; // Changer l'icône pour "afficher"
        toggleBtn.title = 'Afficher le mot de passe';
    }
}

// Sauvegarder automatiquement l'état quand le formulaire change
document.addEventListener('change', saveState);
document.addEventListener('input', saveState);

// Restaurer l'état au chargement
restoreState();

// Nettoyage
window.addEventListener('beforeunload', function () {
    if (autoLoadTimeout) {
        clearTimeout(autoLoadTimeout);
        autoLoadTimeout = null;
    }
});