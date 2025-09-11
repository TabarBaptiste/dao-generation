/**
 * Application constants to eliminate magic strings and numbers
 */
export const STORAGE_KEYS = {
    CONNECTIONS: 'phpDaoGenerator.connections'
} as const;

export const ENCRYPTION = {
    ALGORITHM: 'aes-256-cbc',
    KEY: 'phpDaoGenerator_storage_key_v1',
    SALT: 'salt'
} as const;

export const WEBVIEW_TYPES = {
    CONNECTION_FORM: 'connectionForm',
    TABLE_SELECTION: 'tableSelection'
} as const;

export const VIEW_TITLES = {
    ADD_CONNECTION: 'Add Database Connection',
    EDIT_CONNECTION: 'Edit Database Connection',
    TABLE_SELECTION: 'Tables'
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