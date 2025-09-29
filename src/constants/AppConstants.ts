/**
 * Application constants to eliminate magic strings and numbers
 */
export const STORAGE_KEYS = {
    CONNECTIONS: 'phpDaoGenerator.serveurs'
} as const;

export const ENCRYPTION = {
    ALGORITHM: 'aes-256-cbc',
    KEY: 'phpDaoGenerator_storage_key_v1',
    SALT: 'salt'
} as const;

export const WEBVIEW_TYPES = {
    CONNECTION_FORM: 'serveurForm',
    TABLE_SELECTION: 'tableSelection'
} as const;

export const WEBVIEW_FOLDERS = {
    CONNECTION_FORM: 'serveurs-form',
    TABLE_SELECTION: 'table-selection'
} as const;

export const VIEW_TITLES = {
    ADD_CONNECTION: 'Ajouter un serveur',
    EDIT_CONNECTION: 'Modifier les informations du serveur',
    TABLE_SELECTION: 'Tables'
} as const;

export const BUTTON_LABELS = {
    CREATE: 'Créer',
    UPDATE: 'Mettre à jour',
    CANCEL: 'Annuler',
    TEST_CONNECTION: 'Tester la Serveur'
} as const;

export const DATABASE_SYSTEM_SCHEMAS = [
    'information_schema',
    'performance_schema',
    'mysql',
    'sys'
] as const;

export const DEFAULT_PATHS = {
    WAMP_WWW: 'D:\\wamp64\\www',
    LOCAL_CLASSES: 'local/__classes/DAO',
    DAO_FOLDER: 'DAO'
} as const;

export const FILE_EXTENSIONS = {
    PHP: '.php',
    JSON: '.json'
} as const;

export const VERSION_PATTERN = {
    INITIAL: '1.00',
    INCREMENT: 10
} as const;

export const SORT = {
    ALPHABETICAL: 'alphabetical',
    DATE: 'date'
} as const;