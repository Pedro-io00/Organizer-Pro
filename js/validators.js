// Validações de entrada de dados

/**
 * Valida email
 * @param {string} email
 * @returns {{valid: boolean, message: string}}
 */
export function validateEmail(email) {
    if (!email) {
        return { valid: false, message: 'Email é obrigatório' };
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { valid: false, message: 'Email inválido' };
    }
    
    return { valid: true, message: '' };
}

/**
 * Valida senha com critérios de segurança
 * @param {string} password
 * @returns {{valid: boolean, message: string, strength: number}}
 */
export function validatePassword(password) {
    if (!password) {
        return { valid: false, message: 'Senha é obrigatória', strength: 0 };
    }
    
    if (password.length < 6) {
        return { valid: false, message: 'Senha deve ter no mínimo 6 caracteres', strength: 0 };
    }
    
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    return { valid: true, message: '', strength };
}

/**
 * Calcula e retorna informações sobre força da senha
 * @param {number} strength - Força de 0 a 5
 * @returns {{label: string, color: string, width: string}}
 */
export function getPasswordStrengthInfo(strength) {
    if (strength <= 2) {
        return { label: 'Fraca', color: 'bg-rose-500', width: '33%' };
    } else if (strength <= 3) {
        return { label: 'Boa', color: 'bg-amber-500', width: '66%' };
    } else {
        return { label: 'Forte', color: 'bg-emerald-500', width: '100%' };
    }
}

/**
 * Valida nome de usuário
 * @param {string} name
 * @returns {{valid: boolean, message: string}}
 */
export function validateName(name) {
    if (!name || !name.trim()) {
        return { valid: false, message: 'Nome é obrigatório' };
    }
    
    if (name.trim().length < 2) {
        return { valid: false, message: 'Nome deve ter pelo menos 2 caracteres' };
    }
    
    if (name.trim().length > 50) {
        return { valid: false, message: 'Nome muito longo (máximo 50 caracteres)' };
    }
    
    return { valid: true, message: '' };
}

/**
 * Valida valor numérico
 * @param {string|number} value
 * @param {Object} options - {min, max, required}
 * @returns {{valid: boolean, message: string}}
 */
export function validateNumber(value, options = {}) {
    const { min, max, required = true } = options;
    
    if (!value && value !== 0) {
        if (required) {
            return { valid: false, message: 'Valor é obrigatório' };
        }
        return { valid: true, message: '' };
    }
    
    const num = parseFloat(value);
    
    if (isNaN(num)) {
        return { valid: false, message: 'Valor deve ser um número' };
    }
    
    if (min !== undefined && num < min) {
        return { valid: false, message: `Valor mínimo: ${min}` };
    }
    
    if (max !== undefined && num > max) {
        return { valid: false, message: `Valor máximo: ${max}` };
    }
    
    return { valid: true, message: '' };
}

/**
 * Valida data
 * @param {string} dateString
 * @param {Object} options - {future, past, required}
 * @returns {{valid: boolean, message: string}}
 */
export function validateDate(dateString, options = {}) {
    const { future = false, past = false, required = true } = options;
    
    if (!dateString) {
        if (required) {
            return { valid: false, message: 'Data é obrigatória' };
        }
        return { valid: true, message: '' };
    }
    
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(date.getTime())) {
        return { valid: false, message: 'Data inválida' };
    }
    
    if (future && date < today) {
        return { valid: false, message: 'Data deve ser futura' };
    }
    
    if (past && date > today) {
        return { valid: false, message: 'Data deve ser passada' };
    }
    
    return { valid: true, message: '' };
}

/**
 * Valida texto genérico
 * @param {string} text
 * @param {Object} options - {minLength, maxLength, required}
 * @returns {{valid: boolean, message: string}}
 */
export function validateText(text, options = {}) {
    const { minLength = 1, maxLength = 500, required = true } = options;
    
    if (!text || !text.trim()) {
        if (required) {
            return { valid: false, message: 'Campo obrigatório' };
        }
        return { valid: true, message: '' };
    }
    
    const trimmed = text.trim();
    
    if (trimmed.length < minLength) {
        return { valid: false, message: `Mínimo de ${minLength} caracteres` };
    }
    
    if (trimmed.length > maxLength) {
        return { valid: false, message: `Máximo de ${maxLength} caracteres` };
    }
    
    return { valid: true, message: '' };
}

/**
 * Valida peso corporal
 * @param {number} weight
 * @returns {{valid: boolean, message: string}}
 */
export function validateWeight(weight) {
    return validateNumber(weight, {
        min: 30,
        max: 200,
        required: true
    });
}

/**
 * Valida quantidade de água em ml
 * @param {number} ml
 * @returns {{valid: boolean, message: string}}
 */
export function validateWaterAmount(ml) {
    return validateNumber(ml, {
        min: 50,
        max: 5000,
        required: true
    });
}
