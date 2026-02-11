// Configurações centralizadas da aplicação

/**
 * Obtém a configuração do Firebase do HTML
 * @returns {Object}
 */
export function getFirebaseConfig() {
    try {
        return JSON.parse(window.__firebase_config || '{}');
    } catch (error) {
        console.error('Erro ao carregar configuração Firebase:', error);
        return null;
    }
}

/**
 * Obtém o ID da aplicação
 * @returns {string}
 */
export function getAppId() {
    return window.__app_id || 'lifehub-platinum-v1';
}

/**
 * Configurações gerais da aplicação
 */
export const APP_CONFIG = {
    // Água
    DEFAULT_WEIGHT: 70, // kg
    DEFAULT_WATER_GOAL: 2.5, // litros
    WATER_PER_KG: 35, // ml por kg de peso
    
    // Pomodoro
    POMODORO_DURATION: 25 * 60, // segundos
    POMODORO_BREAK: 5 * 60, // segundos
    
    // UI
    TOAST_DURATION: 3000, // ms
    ERROR_MESSAGE_DURATION: 7000, // ms
    LOADING_MIN_DURATION: 500, // ms
    
    // Limites
    MAX_TASK_LENGTH: 200,
    MAX_NOTE_LENGTH: 2000,
    MAX_GOAL_LENGTH: 100,
    MAX_HABIT_LENGTH: 50,
    
    // Firestore
    TASKS_LIMIT: 100,
    NOTES_LIMIT: 50,
    EVENTS_LIMIT: 100,
    
    // Validações
    MIN_PASSWORD_LENGTH: 6,
    MAX_NAME_LENGTH: 50,
    MIN_WEIGHT: 30,
    MAX_WEIGHT: 200,
};

/**
 * Textos e mensagens padronizadas
 */
export const MESSAGES = {
    // Autenticação
    AUTH_LOGIN_SUCCESS: 'Login realizado com sucesso!',
    AUTH_LOGOUT_CONFIRM: 'Deseja realmente sair?',
    AUTH_EMAIL_REQUIRED: 'Preencha o email',
    AUTH_PASSWORD_REQUIRED: 'Preencha a senha',
    AUTH_NAME_REQUIRED: 'Preencha o nome',
    AUTH_INVALID_CREDENTIALS: 'Email ou senha incorretos',
    AUTH_USER_NOT_FOUND: 'Utilizador não encontrado',
    AUTH_WRONG_PASSWORD: 'Palavra-passe incorreta',
    AUTH_EMAIL_IN_USE: 'Este email já está em uso',
    AUTH_WEAK_PASSWORD: 'Palavra-passe muito fraca',
    AUTH_TOO_MANY_REQUESTS: 'Muitas tentativas. Tente mais tarde',
    AUTH_PASSWORD_RESET_SENT: 'Email de recuperação enviado! Verifique sua caixa de entrada',
    AUTH_PASSWORD_RESET_ERROR: 'Erro ao enviar email de recuperação',
    
    // Operações genéricas
    OPERATION_SUCCESS: 'Operação realizada com sucesso!',
    OPERATION_ERROR: 'Erro ao realizar operação',
    SAVE_SUCCESS: 'Salvo com sucesso!',
    DELETE_SUCCESS: 'Excluído com sucesso!',
    DELETE_CONFIRM: 'Tem certeza que deseja excluir?',
    
    // Água
    WATER_GOAL_REACHED: '🏆 Meta diária de água alcançada! Parabéns!',
    WATER_CONFIG_SAVED: '✅ Configuração salva com sucesso!',
    
    // Conexão
    OFFLINE: '⚠️ Sem conexão com a internet',
    ONLINE: '✅ Conexão restaurada!',
    
    // Validações
    INVALID_EMAIL: 'Email inválido',
    FIELD_REQUIRED: 'Este campo é obrigatório',
    INVALID_VALUE: 'Valor inválido',
};

/**
 * Mapeamento de códigos de erro Firebase para mensagens amigáveis
 */
export const FIREBASE_ERROR_MESSAGES = {
    // Auth
    'auth/user-not-found': MESSAGES.AUTH_USER_NOT_FOUND,
    'auth/wrong-password': MESSAGES.AUTH_WRONG_PASSWORD,
    'auth/invalid-email': MESSAGES.INVALID_EMAIL,
    'auth/email-already-in-use': MESSAGES.AUTH_EMAIL_IN_USE,
    'auth/weak-password': MESSAGES.AUTH_WEAK_PASSWORD,
    'auth/too-many-requests': MESSAGES.AUTH_TOO_MANY_REQUESTS,
    'auth/operation-not-allowed': '⚠️ Método de login não está ativado',
    'auth/unauthorized-domain': '⚠️ Domínio não autorizado',
    'auth/popup-blocked': '⚠️ Popup bloqueado pelo navegador',
    'auth/popup-closed-by-user': null, // Não mostrar erro
    'auth/cancelled-popup-request': null, // Não mostrar erro
    'auth/network-request-failed': '⚠️ Erro de conexão',
    
    // Firestore
    'permission-denied': '⚠️ Permissão negada',
    'unavailable': '⚠️ Serviço temporariamente indisponível',
    'deadline-exceeded': '⚠️ Tempo limite excedido',
};

/**
 * Obtém mensagem de erro amigável
 * @param {Error} error
 * @returns {string}
 */
export function getErrorMessage(error) {
    if (!error) return MESSAGES.OPERATION_ERROR;
    
    const code = error.code;
    if (code && FIREBASE_ERROR_MESSAGES[code] !== undefined) {
        return FIREBASE_ERROR_MESSAGES[code] || '';
    }
    
    return error.message || MESSAGES.OPERATION_ERROR;
}
