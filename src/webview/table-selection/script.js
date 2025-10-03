// ============================================================================
// VS Code API & State Management
// ============================================================================
const vscode = acquireVsCodeApi();

// ============================================================================
// DOM Elements Cache
// ============================================================================
const elements = {
    tableList: null,
    selectedCount: null,
    generateBtn: null,
    selectAllBtn: null,
    selectNoneBtn: null,
    searchInput: null,
    clearSearchBtn: null,
    databaseName: null,
    hostName: null
};

// ============================================================================
// Application State
// ============================================================================
const state = {
    tablesData: [],
    filteredTables: [],
    selectedTables: new Set(),
    searchTerm: '',
    commonPrefix: ''
};

// ============================================================================
// Configuration
// ============================================================================
const CONFIG = {
    DEBOUNCE_DELAY: 0,
    COMMON_PREFIX_THRESHOLD: 0.7,
    FUZZY_MATCH_THRESHOLD: 0.6,
    MAX_LEVENSHTEIN_DISTANCE: 3
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Crée une fonction debounced qui retarde l'exécution
 * @param {Function} func - Fonction à debouncer
 * @param {number} delay - Délai en millisecondes
 */
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Échappe les caractères HTML pour éviter les injections XSS
 * @param {string} text - Texte à échapper
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 * Utilisé pour le fuzzy matching
 * @param {string} a - Première chaîne
 * @param {string} b - Deuxième chaîne
 */
function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill(null).map(() =>
        Array(a.length + 1).fill(null)
    );

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,     // insertion
                matrix[j - 1][i] + 1,     // suppression
                matrix[j - 1][i - 1] + indicator // substitution
            );
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Normalise une chaîne pour la recherche (supprime accents, ponctuation, etc.)
 * @param {string} str - Chaîne à normaliser
 */
function normalizeString(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
        .replace(/[_-]/g, ' ')            // Remplace _ et - par espaces
        .trim();
}

/**
 * Calcule un score de correspondance fuzzy entre une recherche et un texte
 * @param {string} searchTerm - Terme de recherche
 * @param {string} text - Texte à comparer
 * @returns {number} Score entre 0 et 1 (1 = correspondance parfaite)
 */
function fuzzyMatchScore(searchTerm, text) {
    const normalizedSearch = normalizeString(searchTerm);
    const normalizedText = normalizeString(text);

    // Correspondance exacte avec bonus selon la position
    if (normalizedText.includes(normalizedSearch)) {
        const index = normalizedText.indexOf(normalizedSearch);
        const textLength = normalizedText.length;

        // Score de base pour correspondance exacte
        let score = 1.0;

        // Bonus si le terme est au début (après espaces/underscores)
        if (index === 0) {
            score += 0.5; // Commence exactement par le terme
        } else {
            // Vérifier si c'est le début d'un mot (après espace ou underscore)
            const prevChar = normalizedText[index - 1];
            if (prevChar === ' ' || prevChar === '_') {
                score += 0.3; // Début de mot
            }
        }

        // Bonus si le terme est un mot complet (entouré d'espaces/underscores ou fin de chaîne)
        const nextIndex = index + normalizedSearch.length;
        const isCompleteWord = (
            (index === 0 || normalizedText[index - 1] === ' ') &&
            (nextIndex === textLength || normalizedText[nextIndex] === ' ')
        );

        if (isCompleteWord) {
            score += 0.3; // Mot complet
        }

        // Bonus selon la proportion du terme dans le texte
        const proportionBonus = normalizedSearch.length / textLength * 0.2;
        score += proportionBonus;

        // Pénalité selon la distance du début (plus c'est loin, moins bon)
        const positionPenalty = (index / textLength) * 0.3;
        score -= positionPenalty;

        return score;
    }

    // Vérifier si tous les caractères de la recherche apparaissent dans l'ordre
    let searchIndex = 0;
    let matchedChars = 0;

    for (let i = 0; i < normalizedText.length && searchIndex < normalizedSearch.length; i++) {
        if (normalizedText[i] === normalizedSearch[searchIndex]) {
            matchedChars++;
            searchIndex++;
        }
    }

    const sequenceScore = matchedChars / normalizedSearch.length;

    // Si moins de 50% des caractères correspondent, utiliser Levenshtein
    if (sequenceScore < 0.5) {
        const distance = levenshteinDistance(normalizedSearch, normalizedText);
        const maxLength = Math.max(normalizedSearch.length, normalizedText.length);

        // Rejeter si la distance est trop grande
        if (distance > CONFIG.MAX_LEVENSHTEIN_DISTANCE) {
            return 0;
        }

        return Math.max(0, 1 - (distance / maxLength));
    }

    return sequenceScore;
}

/**
 * Détecte le préfixe commun dans une liste de tables
 * @param {string[]} tables - Liste des noms de tables
 */
function detectCommonPrefix(tables) {
    if (tables.length === 0) return '';

    const firstTable = tables[0].toLowerCase();
    let commonPrefix = '';

    // Chercher les positions des underscores
    for (let i = 0; i < firstTable.length; i++) {
        if (firstTable[i] === '_') {
            const potentialPrefix = firstTable.substring(0, i + 1);

            // Vérifier si ce préfixe est commun à au moins X% des tables
            const matchCount = tables.filter(table =>
                table.toLowerCase().startsWith(potentialPrefix)
            ).length;

            if (matchCount / tables.length >= CONFIG.COMMON_PREFIX_THRESHOLD) {
                commonPrefix = potentialPrefix;
            }
        }
    }

    return commonPrefix;
}

/**
 * Retire le préfixe commun d'un nom de table pour la recherche
 * @param {string} tableName - Nom de la table
 */
function removeCommonPrefix(tableName) {
    if (state.commonPrefix && tableName.toLowerCase().startsWith(state.commonPrefix)) {
        return tableName.substring(state.commonPrefix.length);
    }
    return tableName;
}

// ============================================================================
// Search & Filter Logic
// ============================================================================

/**
 * Filtre les tables selon le terme de recherche avec fuzzy matching
 * @param {string} searchTerm - Terme de recherche
 */
function filterTables(searchTerm) {
    if (!searchTerm.trim()) {
        return state.tablesData.slice();
    }

    // Calculer les scores pour chaque table
    const scoredTables = state.tablesData.map(table => {
        const cleanTableName = removeCommonPrefix(table);

        // Score sur le nom complet
        const fullScore = fuzzyMatchScore(searchTerm, table);

        // Score sur le nom sans préfixe
        const cleanScore = fuzzyMatchScore(searchTerm, cleanTableName);

        // Prendre le meilleur score
        const bestScore = Math.max(fullScore, cleanScore);

        return { table, score: bestScore };
    });

    // Filtrer et trier par score décroissant
    return scoredTables
        .filter(item => item.score >= CONFIG.FUZZY_MATCH_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .map(item => item.table);
}

/**
 * Gère la recherche avec debouncing
 */
const handleSearch = debounce(() => {
    const searchTerm = elements.searchInput.value.trim();
    state.searchTerm = searchTerm;

    state.filteredTables = filterTables(searchTerm);
    renderTables();
    updateUI();
    saveState();
}, CONFIG.DEBOUNCE_DELAY);

/**
 * Efface la recherche
 */
function clearSearch() {
    elements.searchInput.value = '';
    state.searchTerm = '';
    state.filteredTables = state.tablesData.slice();
    renderTables();
    updateUI();
    toggleClearButton();
    elements.searchInput.focus();
    saveState();
}

// ============================================================================
// Rendering Logic
// ============================================================================

/**
 * Rend la liste des tables
 */
function renderTables() {
    const tables = state.filteredTables;

    if (state.tablesData.length === 0) {
        elements.tableList.innerHTML = '<div class="loading">Aucune table trouvée dans cette base de données.</div>';
        return;
    }

    if (tables.length === 0) {
        elements.tableList.innerHTML = '<div class="loading">Aucune table ne correspond à votre recherche.</div>';
        return;
    }

    // Construction optimisée avec fragment
    const fragment = document.createDocumentFragment();

    tables.forEach(table => {
        const div = document.createElement('div');
        div.className = 'table-item';
        div.dataset.table = table;

        const label = document.createElement('label');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = table;
        checkbox.checked = state.selectedTables.has(table);
        checkbox.addEventListener('change', handleCheckboxChange);

        const icon = document.createElement('i');
        icon.className = 'codicon codicon-table';

        const text = document.createTextNode(table);

        label.appendChild(checkbox);
        label.appendChild(icon);
        label.appendChild(text);
        div.appendChild(label);
        fragment.appendChild(div);
    });

    elements.tableList.innerHTML = '';
    elements.tableList.appendChild(fragment);
}

/**
 * Gère le changement d'état d'une checkbox
 */
function handleCheckboxChange(event) {
    const table = event.target.value;

    if (event.target.checked) {
        state.selectedTables.add(table);
    } else {
        state.selectedTables.delete(table);
    }

    updateUI();
    saveState();
}

/**
 * Met à jour l'interface utilisateur (compteur, boutons)
 */
function updateUI() {
    const count = state.selectedTables.size;

    elements.selectedCount.innerHTML =
        `<i class="codicon codicon-info"></i> ${count} table(s) sélectionnée(s)`;

    elements.generateBtn.disabled = count === 0;

    toggleClearButton();
}

/**
 * Affiche/cache le bouton d'effacement de recherche
 */
function toggleClearButton() {
    if (elements.searchInput.value.trim()) {
        elements.clearSearchBtn.classList.add('visible');
    } else {
        elements.clearSearchBtn.classList.remove('visible');
    }
}

// ============================================================================
// Selection Management
// ============================================================================

/**
 * Sélectionne toutes les tables visibles
 */
function selectAll() {
    state.filteredTables.forEach(table => state.selectedTables.add(table));
    renderTables();
    updateUI();
    saveState();
}

/**
 * Désélectionne toutes les tables
 */
function selectNone() {
    state.selectedTables.clear();
    renderTables();
    updateUI();
    saveState();
}

// ============================================================================
// VS Code Communication
// ============================================================================

/**
 * Met à jour les données de la page
 */
function updatePageData(data) {
    elements.databaseName.textContent = data.database;
    elements.hostName.textContent = data.host;
}

/**
 * Met à jour la liste des tables
 */
function updateTablesList(tables) {
    state.tablesData = tables;
    state.commonPrefix = detectCommonPrefix(tables);
    state.filteredTables = filterTables(state.searchTerm);

    renderTables();
    updateUI();
    restoreState();
}

/**
 * Affiche un état de chargement
 */
function showLoading() {
    elements.tableList.innerHTML = '<div class="loading">Chargement des tables...</div>';
    elements.generateBtn.disabled = true;
    elements.selectAllBtn.disabled = false;
    elements.selectNoneBtn.disabled = false;
}

/**
 * Affiche une erreur
 */
function showError(errorMessage) {
    elements.tableList.innerHTML = `
        <div class="error">
            <h3>Erreur</h3>
            <p>Impossible de récupérer les tables de la base de données.</p>
            <p><strong>Détail:</strong> ${escapeHtml(errorMessage)}</p>
        </div>
    `;
    elements.generateBtn.disabled = true;
    elements.selectAllBtn.disabled = true;
    elements.selectNoneBtn.disabled = true;
    updateUI();
}

/**
 * Génère les DAOs pour les tables sélectionnées
 */
function generateDao() {
    if (state.selectedTables.size === 0) return;

    const mode = document.querySelector('input[name="mode"]:checked').value;

    vscode.postMessage({
        command: 'generate',
        selectedTables: Array.from(state.selectedTables),
        mode: mode
    });

    // Désélectionner après génération
    selectNone();
}

// ============================================================================
// State Persistence
// ============================================================================

/**
 * Sauvegarde l'état dans VS Code
 */
const saveState = debounce(() => {
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'save';

    vscode.setState({
        selectedTables: Array.from(state.selectedTables),
        mode: mode,
        searchTerm: state.searchTerm
    });
}, 500);

/**
 * Restaure l'état depuis VS Code
 */
function restoreState() {
    const savedState = vscode.getState();
    if (!savedState) return;

    // Restaurer le mode
    if (savedState.mode) {
        const modeRadio = document.querySelector(`input[name="mode"][value="${savedState.mode}"]`);
        if (modeRadio) modeRadio.checked = true;
    }

    // Restaurer la recherche
    if (savedState.searchTerm) {
        elements.searchInput.value = savedState.searchTerm;
        state.searchTerm = savedState.searchTerm;
        state.filteredTables = filterTables(savedState.searchTerm);
    }

    // Restaurer les sélections
    if (savedState.selectedTables) {
        state.selectedTables = new Set(savedState.selectedTables);
    }

    renderTables();
    updateUI();
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

/**
 * Gère les raccourcis clavier
 */
function handleKeyboardShortcuts(event) {
    // Ctrl+F / Cmd+F pour focus sur recherche
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        elements.searchInput.focus();
        elements.searchInput.select();
    }

    // Escape pour effacer/défocus la recherche
    if (event.key === 'Escape' && document.activeElement === elements.searchInput) {
        if (elements.searchInput.value.trim()) {
            clearSearch();
        } else {
            elements.searchInput.blur();
        }
    }

    // Ctrl+A / Cmd+A pour tout sélectionner
    if ((event.ctrlKey || event.metaKey) && event.key === 'a' &&
        document.activeElement !== elements.searchInput) {
        event.preventDefault();
        selectAll();
    }
}

// ============================================================================
// Event Listeners Setup
// ============================================================================

/**
 * Configure tous les écouteurs d'événements
 */
function setupEventListeners() {
    // Boutons
    elements.selectAllBtn.addEventListener('click', selectAll);
    elements.selectNoneBtn.addEventListener('click', selectNone);
    elements.generateBtn.addEventListener('click', generateDao);

    // Recherche
    elements.searchInput.addEventListener('input', () => {
        handleSearch();
        toggleClearButton();
    });
    elements.clearSearchBtn.addEventListener('click', clearSearch);

    // Raccourcis clavier
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Messages de VS Code
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

    // Sauvegarder l'état lors des changements de mode
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
        radio.addEventListener('change', saveState);
    });
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialise les références aux éléments DOM
 */
function initializeElements() {
    elements.tableList = document.getElementById('tableList');
    elements.selectedCount = document.getElementById('selectedCount');
    elements.generateBtn = document.getElementById('generateBtn');
    elements.selectAllBtn = document.getElementById('selectAllBtn');
    elements.selectNoneBtn = document.getElementById('selectNoneBtn');
    elements.searchInput = document.getElementById('searchInput');
    elements.clearSearchBtn = document.getElementById('clearSearchBtn');
    elements.databaseName = document.getElementById('databaseName');
    elements.hostName = document.getElementById('hostName');
}

/**
 * Point d'entrée de l'application
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    setupEventListeners();

    // Demander les données initiales
    vscode.postMessage({ command: 'ready' });
});