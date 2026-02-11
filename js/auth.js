// Módulo de autenticação

import { showMessage, toggleLoading, showToast } from './utils.js';
import { validateEmail, validatePassword, validateName, getPasswordStrengthInfo } from './validators.js';
import { MESSAGES, getErrorMessage } from './config.js';

let authInstance = null;
let currentUser = null;

/**
 * Inicializa o módulo de autenticação
 * @param {Object} auth - Instância do Firebase Auth
 */
export function initAuth(auth) {
    authInstance = auth;
}

/**
 * Obtém o usuário atual
 * @returns {Object|null}
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Define o usuário atual
 * @param {Object} user
 */
export function setCurrentUser(user) {
    currentUser = user;
}

/**
 * Realiza login com email e senha
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function loginWithEmail(email, password) {
    // Validações
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        throw new Error(emailValidation.message);
    }
    
    if (!password) {
        throw new Error(MESSAGES.AUTH_PASSWORD_REQUIRED);
    }
    
    if (!authInstance) {
        throw new Error('Auth não inicializado');
    }
    
    try {
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
        return userCredential.user;
    } catch (error) {
        const message = getErrorMessage(error);
        throw new Error(message);
    }
}

/**
 * Cria nova conta com email e senha
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function registerWithEmail(name, email, password) {
    // Validações
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
        throw new Error(nameValidation.message);
    }
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        throw new Error(emailValidation.message);
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
    }
    
    if (!authInstance) {
        throw new Error('Auth não inicializado');
    }
    
    try {
        const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        return userCredential.user;
    } catch (error) {
        const message = getErrorMessage(error);
        throw new Error(message);
    }
}

/**
 * Login anônimo
 * @returns {Promise<Object>}
 */
export async function loginAnonymously() {
    if (!authInstance) {
        throw new Error('Auth não inicializado');
    }
    
    try {
        const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const userCredential = await signInAnonymously(authInstance);
        return userCredential.user;
    } catch (error) {
        const message = getErrorMessage(error);
        throw new Error(message);
    }
}

/**
 * Login com Google
 * @returns {Promise<Object>}
 */
export async function loginWithGoogle() {
    if (!authInstance) {
        throw new Error('Auth não inicializado');
    }
    
    try {
        const { signInWithPopup, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const userCredential = await signInWithPopup(authInstance, provider);
        return userCredential.user;
    } catch (error) {
        // Ignorar erros de popup fechado
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            return null;
        }
        const message = getErrorMessage(error);
        throw new Error(message);
    }
}

/**
 * Login com Apple
 * @returns {Promise<Object>}
 */
export async function loginWithApple() {
    if (!authInstance) {
        throw new Error('Auth não inicializado');
    }
    
    try {
        const { signInWithPopup, OAuthProvider } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        const userCredential = await signInWithPopup(authInstance, provider);
        return userCredential.user;
    } catch (error) {
        // Ignorar erros de popup fechado
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            return null;
        }
        const message = getErrorMessage(error);
        throw new Error(message);
    }
}

/**
 * Envia email de recuperação de senha
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function sendPasswordReset(email) {
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        throw new Error(emailValidation.message);
    }
    
    if (!authInstance) {
        throw new Error('Auth não inicializado');
    }
    
    try {
        const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        await sendPasswordResetEmail(authInstance, email);
    } catch (error) {
        const message = getErrorMessage(error);
        throw new Error(message);
    }
}

/**
 * Realiza logout
 * @returns {Promise<void>}
 */
export async function logout() {
    if (!authInstance) {
        throw new Error('Auth não inicializado');
    }
    
    try {
        await authInstance.signOut();
        currentUser = null;
    } catch (error) {
        const message = getErrorMessage(error);
        throw new Error(message);
    }
}

/**
 * Atualiza a exibição da verificação de força da senha
 * @param {string} password
 * @param {string} barElementId
 * @param {string} textElementId
 */
export function updatePasswordStrengthUI(password, barElementId, textElementId) {
    const strengthDiv = document.getElementById(barElementId)?.parentElement?.parentElement;
    const strengthBar = document.getElementById(barElementId);
    const strengthText = document.getElementById(textElementId);
    
    if (!strengthBar || !strengthText || !strengthDiv) return;
    
    if (!password) {
        strengthDiv.classList.add('hidden');
        return;
    }
    
    strengthDiv.classList.remove('hidden');
    
    const { strength } = validatePassword(password);
    const { label, color, width } = getPasswordStrengthInfo(strength);
    
    strengthBar.className = `h-full transition-all duration-300 ${color}`;
    strengthBar.style.width = width;
    strengthText.textContent = label;
    strengthText.className = `text-xs font-bold ${color.replace('bg-', 'text-')}`;
}

/**
 * Obtém o nome de exibição do usuário
 * @param {Object} user
 * @returns {string}
 */
export function getUserDisplayName(user) {
    if (!user) return 'Convidado';
    return user.displayName || user.email || 'Convidado';
}

/**
 * Obtém o primeiro nome do usuário
 * @param {Object} user
 * @returns {string}
 */
export function getUserFirstName(user) {
    const displayName = getUserDisplayName(user);
    return displayName.split(' ')[0];
}

/**
 * Obtém a saudação apropriada baseada na hora do dia
 * @returns {string}
 */
export function getGreeting() {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 12) {
        return 'Bom dia';
    } else if (hour >= 12 && hour < 19) {
        return 'Boa tarde';
    } else {
        return 'Boa noite';
    }
}
