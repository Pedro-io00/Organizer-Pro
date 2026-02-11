// Funções utilitárias reutilizáveis

/**
 * Mostra uma mensagem de erro ou sucesso
 * @param {string} message - Mensagem a exibir
 * @param {string} divId - ID do elemento onde mostrar
 * @param {string} type - 'error' ou 'success'
 * @param {number} duration - Duração em ms (padrão: 7000)
 */
export function showMessage(message, divId, type = 'error', duration = 7000) {
    const div = document.getElementById(divId);
    if (!div) {
        console.error('Elemento não encontrado:', divId);
        alert(message);
        return;
    }
    
    div.textContent = message;
    div.classList.remove('hidden');
    
    if (type === 'success') {
        div.classList.remove('bg-rose-50', 'border-rose-200', 'text-rose-600');
        div.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-600');
    } else {
        div.classList.remove('bg-emerald-50', 'border-emerald-200', 'text-emerald-600');
        div.classList.add('bg-rose-50', 'border-rose-200', 'text-rose-600');
    }
    
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    setTimeout(() => {
        div.classList.add('hidden');
        if (type === 'success') {
            div.classList.add('bg-rose-50', 'border-rose-200', 'text-rose-600');
            div.classList.remove('bg-emerald-50', 'border-emerald-200', 'text-emerald-600');
        }
    }, duration);
}

/**
 * Mostra ou esconde um indicador de loading
 * @param {boolean} show - true para mostrar, false para esconder
 * @param {string} elementId - ID do elemento (opcional)
 */
export function toggleLoading(show, elementId = null) {
    if (elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        if (show) {
            element.disabled = true;
            element.dataset.originalText = element.innerHTML;
            element.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>';
            lucide.createIcons();
        } else {
            element.disabled = false;
            element.innerHTML = element.dataset.originalText || element.innerHTML;
            lucide.createIcons();
        }
    }
}

/**
 * Formata uma data para o padrão português
 * @param {Date|number} date - Data a formatar
 * @param {string} format - 'short', 'long', 'time'
 * @returns {string}
 */
export function formatDate(date, format = 'short') {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    
    switch (format) {
        case 'long':
            return d.toLocaleDateString('pt-PT', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long',
                year: 'numeric'
            });
        case 'time':
            return d.toLocaleTimeString('pt-PT', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        default:
            return d.toLocaleDateString('pt-PT');
    }
}

/**
 * Sanitiza uma string para prevenir XSS
 * @param {string} str - String a sanitizar
 * @returns {string}
 */
export function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * Debounce function para otimizar eventos frequentes
 * @param {Function} func - Função a executar
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Calcula streak de hábitos
 * @param {Array} dates - Array de datas em formato ISO
 * @returns {number}
 */
export function calculateStreak(dates) {
    if (!dates?.length) return 0;
    
    const sorted = [...dates].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    let streak = 0;
    let current = new Date(today);
    
    for (let i = 0; i < sorted.length; i++) {
        const dateStr = current.toISOString().split('T')[0];
        if (sorted.includes(dateStr)) {
            streak++;
            current.setDate(current.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

/**
 * Mostra uma notificação toast
 * @param {string} message - Mensagem
 * @param {string} type - 'success', 'error', 'info'
 */
export function showToast(message, type = 'info') {
    const existingToast = document.getElementById('app-toast');
    if (existingToast) existingToast.remove();
    
    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-rose-500',
        info: 'bg-indigo-500'
    };
    
    const toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = `fixed bottom-6 right-6 ${colors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl z-[300] flex items-center gap-3 animate-slide-up max-w-md`;
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info'}" class="w-5 h-5 flex-shrink-0"></i>
        <span class="font-medium">${sanitizeHTML(message)}</span>
    `;
    
    document.body.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.style.animation = 'slide-down 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Verifica se o usuário está online
 * @returns {boolean}
 */
export function isOnline() {
    return navigator.onLine;
}

/**
 * Adiciona listener para mudanças de conectividade
 */
export function setupConnectivityListener() {
    window.addEventListener('online', () => {
        showToast('✅ Conexão restaurada!', 'success');
    });
    
    window.addEventListener('offline', () => {
        showToast('⚠️ Sem conexão com a internet', 'error');
    });
}

/**
 * Copia texto para a área de transferência
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Erro ao copiar:', err);
        return false;
    }
}

/**
 * Gera um ID único
 * @returns {string}
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Valida formato de email
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Escapa caracteres especiais para uso seguro em HTML
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
