// Módulo de operações de banco de dados (Firestore)

import { showToast } from './utils.js';
import { getAppId, APP_CONFIG, MESSAGES } from './config.js';
import { validateText, validateNumber } from './validators.js';

let dbInstance = null;
let appId = null;

/**
 * Inicializa o módulo de banco de dados
 * @param {Object} db - Instância do Firestore
 */
export function initDatabase(db) {
    dbInstance = db;
    appId = getAppId();
}

/**
 * Obtém a referência base do usuário
 * @param {string} userId
 * @returns {string}
 */
function getUserBasePath(userId) {
    return `artifacts/${appId}/users/${userId}`;
}

// ==================== TAREFAS ====================

/**
 * Adiciona uma nova tarefa
 * @param {string} userId
 * @param {string} text
 * @param {string} priority
 * @returns {Promise<Object>}
 */
export async function addTask(userId, text, priority = 'medium') {
    const validation = validateText(text, { maxLength: APP_CONFIG.MAX_TASK_LENGTH });
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    
    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const docRef = await addDoc(collection(dbInstance, getUserBasePath(userId), 'tasks'), {
            text,
            priority,
            completed: false,
            createdAt: serverTimestamp()
        });
        return { id: docRef.id, text, priority, completed: false };
    } catch (error) {
        console.error('Erro ao adicionar tarefa:', error);
        throw new Error('Erro ao adicionar tarefa');
    }
}

/**
 * Atualiza status de conclusão da tarefa
 * @param {string} userId
 * @param {string} taskId
 * @param {boolean} completed
 * @returns {Promise<void>}
 */
export async function toggleTaskComplete(userId, taskId, completed) {
    try {
        const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const updateData = {
            completed: !completed
        };
        
        // Adicionar timestamp quando completar a tarefa
        if (!completed) {
            updateData.completedAt = serverTimestamp();
        } else {
            // Remover timestamp quando desmarcar
            updateData.completedAt = null;
        }
        
        await updateDoc(doc(dbInstance, getUserBasePath(userId), 'tasks', taskId), updateData);
    } catch (error) {
        console.error('Erro ao atualizar tarefa:', error);
        throw new Error('Erro ao atualizar tarefa');
    }
}

/**
 * Exclui uma tarefa
 * @param {string} userId
 * @param {string} taskId
 * @returns {Promise<void>}
 */
export async function deleteTask(userId, taskId) {
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await deleteDoc(doc(dbInstance, getUserBasePath(userId), 'tasks', taskId));
    } catch (error) {
        console.error('Erro ao excluir tarefa:', error);
        throw new Error('Erro ao excluir tarefa');
    }
}

// ==================== SUBTAREFAS ====================

/**
 * Adiciona uma subtarefa
 * @param {string} userId
 * @param {string} taskId
 * @param {string} text
 * @returns {Promise<Object>}
 */
export async function addSubtask(userId, taskId, text) {
    const validation = validateText(text, { maxLength: APP_CONFIG.MAX_TASK_LENGTH });
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    
    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const docRef = await addDoc(collection(dbInstance, getUserBasePath(userId), 'tasks', taskId, 'subtasks'), {
            text,
            completed: false,
            createdAt: serverTimestamp()
        });
        return { id: docRef.id, text, completed: false };
    } catch (error) {
        console.error('Erro ao adicionar subtarefa:', error);
        throw new Error('Erro ao adicionar subtarefa');
    }
}

/**
 * Atualiza status de subtarefa
 * @param {string} userId
 * @param {string} taskId
 * @param {string} subtaskId
 * @param {boolean} completed
 * @returns {Promise<void>}
 */
export async function toggleSubtaskComplete(userId, taskId, subtaskId, completed) {
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await updateDoc(doc(dbInstance, getUserBasePath(userId), 'tasks', taskId, 'subtasks', subtaskId), {
            completed: !completed
        });
    } catch (error) {
        console.error('Erro ao atualizar subtarefa:', error);
        throw new Error('Erro ao atualizar subtarefa');
    }
}

/**
 * Exclui uma subtarefa
 * @param {string} userId
 * @param {string} taskId
 * @param {string} subtaskId
 * @returns {Promise<void>}
 */
export async function deleteSubtask(userId, taskId, subtaskId) {
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await deleteDoc(doc(dbInstance, getUserBasePath(userId), 'tasks', taskId, 'subtasks', subtaskId));
    } catch (error) {
        console.error('Erro ao excluir subtarefa:', error);
        throw new Error('Erro ao excluir subtarefa');
    }
}

// ==================== COMPRAS ====================

/**
 * Adiciona item à lista de compras
 * @param {string} userId
 * @param {string} name
 * @returns {Promise<Object>}
 */
export async function addShoppingItem(userId, name) {
    const validation = validateText(name, { maxLength: 100 });
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    
    try {
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const docRef = await addDoc(collection(dbInstance, getUserBasePath(userId), 'shopping'), {
            name,
            bought: false
        });
        return { id: docRef.id, name, bought: false };
    } catch (error) {
        console.error('Erro ao adicionar item:', error);
        throw new Error('Erro ao adicionar item');
    }
}

/**
 * Marca/desmarca item como comprado
 * @param {string} userId
 * @param {string} itemId
 * @param {boolean} bought
 * @returns {Promise<void>}
 */
export async function toggleShoppingItem(userId, itemId, bought) {
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await updateDoc(doc(dbInstance, getUserBasePath(userId), 'shopping', itemId), {
            bought: !bought
        });
    } catch (error) {
        console.error('Erro ao atualizar item:', error);
        throw new Error('Erro ao atualizar item');
    }
}

/**
 * Exclui item da lista
 * @param {string} userId
 * @param {string} itemId
 * @returns {Promise<void>}
 */
export async function deleteShoppingItem(userId, itemId) {
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await deleteDoc(doc(dbInstance, getUserBasePath(userId), 'shopping', itemId));
    } catch (error) {
        console.error('Erro ao excluir item:', error);
        throw new Error('Erro ao excluir item');
    }
}

/**
 * Remove todos os itens comprados
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function clearBoughtItems(userId) {
    try {
        const { collection, getDocs, doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const snap = await getDocs(collection(dbInstance, getUserBasePath(userId), 'shopping'));
        const boughtItems = snap.docs.filter(d => d.data().bought);
        
        for (const item of boughtItems) {
            await deleteDoc(doc(dbInstance, getUserBasePath(userId), 'shopping', item.id));
        }
        
        return boughtItems.length;
    } catch (error) {
        console.error('Erro ao limpar itens:', error);
        throw new Error('Erro ao limpar itens');
    }
}

// ==================== FINANÇAS ====================

/**
 * Adiciona transação financeira
 * @param {string} userId
 * @param {string} description
 * @param {number} amount
 * @returns {Promise<Object>}
 */
export async function addTransaction(userId, description, amount) {
    const descValidation = validateText(description, { maxLength: 200 });
    if (!descValidation.valid) {
        throw new Error(descValidation.message);
    }
    
    const amountValidation = validateNumber(amount);
    if (!amountValidation.valid) {
        throw new Error(amountValidation.message);
    }
    
    try {
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const docRef = await addDoc(collection(dbInstance, getUserBasePath(userId), 'finance'), {
            desc: description,
            amount: parseFloat(amount),
            date: new Date().toISOString()
        });
        return { id: docRef.id, desc: description, amount: parseFloat(amount), date: new Date().toISOString() };
    } catch (error) {
        console.error('Erro ao adicionar transação:', error);
        throw new Error('Erro ao adicionar transação');
    }
}

/**
 * Exclui transação
 * @param {string} userId
 * @param {string} transactionId
 * @returns {Promise<void>}
 */
export async function deleteTransaction(userId, transactionId) {
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await deleteDoc(doc(dbInstance, getUserBasePath(userId), 'finance', transactionId));
    } catch (error) {
        console.error('Erro ao excluir transação:', error);
        throw new Error('Erro ao excluir transação');
    }
}

// ==================== NOTAS ====================

/**
 * Adiciona uma nota
 * @param {string} userId
 * @param {string} content
 * @returns {Promise<Object>}
 */
export async function addNote(userId, content) {
    const validation = validateText(content, { maxLength: APP_CONFIG.MAX_NOTE_LENGTH });
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    
    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const docRef = await addDoc(collection(dbInstance, getUserBasePath(userId), 'notes'), {
            content,
            createdAt: serverTimestamp()
        });
        return { id: docRef.id, content };
    } catch (error) {
        console.error('Erro ao adicionar nota:', error);
        throw new Error('Erro ao adicionar nota');
    }
}

/**
 * Exclui uma nota
 * @param {string} userId
 * @param {string} noteId
 * @returns {Promise<void>}
 */
export async function deleteNote(userId, noteId) {
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await deleteDoc(doc(dbInstance, getUserBasePath(userId), 'notes', noteId));
    } catch (error) {
        console.error('Erro ao excluir nota:', error);
        throw new Error('Erro ao excluir nota');
    }
}

// ==================== HÁBITOS ====================

/**
 * Adiciona um hábito
 * @param {string} userId
 * @param {string} name
 * @returns {Promise<Object>}
 */
export async function addHabit(userId, name) {
    const validation = validateText(name, { maxLength: APP_CONFIG.MAX_HABIT_LENGTH });
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    
    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const docRef = await addDoc(collection(dbInstance, getUserBasePath(userId), 'habits'), {
            name,
            streak: 0,
            lastChecked: null,
            completedDates: [],
            createdAt: serverTimestamp()
        });
        return { id: docRef.id, name, streak: 0, completedDates: [] };
    } catch (error) {
        console.error('Erro ao adicionar hábito:', error);
        throw new Error('Erro ao adicionar hábito');
    }
}

/**
 * Marca/desmarca hábito como feito hoje
 * @param {string} userId
 * @param {string} habitId
 * @param {Array} completedDates
 * @param {number} currentStreak
 * @returns {Promise<void>}
 */
export async function toggleHabitToday(userId, habitId, completedDates = [], currentStreak = 0) {
    const today = new Date().toISOString().split('T')[0];
    const dates = completedDates || [];
    const isCompleted = dates.includes(today);
    
    const newDates = isCompleted 
        ? dates.filter(d => d !== today)
        : [...dates, today];
    
    // Recalcular streak
    const streak = calculateHabitStreak(newDates);
    
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await updateDoc(doc(dbInstance, getUserBasePath(userId), 'habits', habitId), {
            completedDates: newDates,
            streak,
            lastChecked: today
        });
    } catch (error) {
        console.error('Erro ao atualizar hábito:', error);
        throw new Error('Erro ao atualizar hábito');
    }
}

/**
 * Calcula streak de um hábito
 * @param {Array} dates
 * @returns {number}
 */
function calculateHabitStreak(dates) {
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
 * Exclui um hábito
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<void>}
 */
export async function deleteHabit(userId, habitId) {
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await deleteDoc(doc(dbInstance, getUserBasePath(userId), 'habits', habitId));
    } catch (error) {
        console.error('Erro ao excluir hábito:', error);
        throw new Error('Erro ao excluir hábito');
    }
}

// ==================== METAS ====================

/**
 * Adiciona uma meta
 * @param {string} userId
 * @param {string} title
 * @param {string} description
 * @param {string} period
 * @returns {Promise<Object>}
 */
export async function addGoal(userId, title, description = '', period = 'mensal') {
    const titleValidation = validateText(title, { maxLength: APP_CONFIG.MAX_GOAL_LENGTH });
    if (!titleValidation.valid) {
        throw new Error(titleValidation.message);
    }
    
    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const docRef = await addDoc(collection(dbInstance, getUserBasePath(userId), 'goals'), {
            title,
            description,
            period,
            progress: 0,
            completed: false,
            createdAt: serverTimestamp()
        });
        return { id: docRef.id, title, description, period, progress: 0, completed: false };
    } catch (error) {
        console.error('Erro ao adicionar meta:', error);
        throw new Error('Erro ao adicionar meta');
    }
}

/**
 * Atualiza progresso de uma meta
 * @param {string} userId
 * @param {string} goalId
 * @param {number} progress
 * @returns {Promise<void>}
 */
export async function updateGoalProgress(userId, goalId, progress) {
    const newProgress = Math.min(100, Math.max(0, progress));
    
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await updateDoc(doc(dbInstance, getUserBasePath(userId), 'goals', goalId), {
            progress: newProgress,
            completed: newProgress === 100
        });
    } catch (error) {
        console.error('Erro ao atualizar meta:', error);
        throw new Error('Erro ao atualizar meta');
    }
}

/**
 * Exclui uma meta
 * @param {string} userId
 * @param {string} goalId
 * @returns {Promise<void>}
 */
export async function deleteGoal(userId, goalId) {
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await deleteDoc(doc(dbInstance, getUserBasePath(userId), 'goals', goalId));
    } catch (error) {
        console.error('Erro ao excluir meta:', error);
        throw new Error('Erro ao excluir meta');
    }
}

// ==================== EVENTOS ====================

/**
 * Adiciona um evento ao calendário
 * @param {string} userId
 * @param {string} title
 * @param {string} date
 * @param {string} time
 * @returns {Promise<Object>}
 */
export async function addEvent(userId, title, date, time = '') {
    const titleValidation = validateText(title, { maxLength: 100 });
    if (!titleValidation.valid) {
        throw new Error(titleValidation.message);
    }
    
    if (!date) {
        throw new Error('Data é obrigatória');
    }
    
    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const docRef = await addDoc(collection(dbInstance, getUserBasePath(userId), 'events'), {
            title,
            date,
            time: time || '',
            createdAt: serverTimestamp()
        });
        return { id: docRef.id, title, date, time };
    } catch (error) {
        console.error('Erro ao adicionar evento:', error);
        throw new Error('Erro ao adicionar evento');
    }
}

/**
 * Exclui um evento
 * @param {string} userId
 * @param {string} eventId
 * @returns {Promise<void>}
 */
export async function deleteEvent(userId, eventId) {
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await deleteDoc(doc(dbInstance, getUserBasePath(userId), 'events', eventId));
    } catch (error) {
        console.error('Erro ao excluir evento:', error);
        throw new Error('Erro ao excluir evento');
    }
}

// ==================== ESTATÍSTICAS DIÁRIAS ====================

/**
 * Adiciona água consumida
* @param {string} userId
 * @param {number} ml
 * @returns {Promise<void>}
 */
export async function addWater(userId, ml) {
    try {
        const { doc, getDoc, updateDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const ref = doc(dbInstance, getUserBasePath(userId), 'daily', 'stats');
        const snap = await getDoc(ref);
        
        if (snap.exists()) {
            const current = snap.data().water || 0;
            await updateDoc(ref, { water: current + ml });
        } else {
            await setDoc(ref, { water: ml, focusMinutes: 0, cycles: 0 });
        }
    } catch (error) {
        console.error('Erro ao adicionar água:', error);
        throw new Error('Erro ao registrar água');
    }
}

/**
 * Atualiza minutos de foco
 * @param {string} userId
 * @param {number} minutes
 * @param {number} cycles
 * @returns {Promise<void>}
 */
export async function updateFocusStats(userId, minutes, cycles = 1) {
    try {
        const { doc, getDoc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const ref = doc(dbInstance, getUserBasePath(userId), 'daily', 'stats');
        const snap = await getDoc(ref);
        const stats = snap.data() || {};
        
        await updateDoc(ref, {
            focusMinutes: (stats.focusMinutes || 0) + minutes,
            cycles: (stats.cycles || 0) + cycles
        });
    } catch (error) {
        console.error('Erro ao atualizar foco:', error);
        throw new Error('Erro ao atualizar estatísticas');
    }
}

/**
 * Salva configurações do usuário (peso, meta de água)
 * @param {string} userId
 * @param {Object} settings
 * @returns {Promise<void>}
 */
export async function saveUserSettings(userId, settings) {
    try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        await setDoc(doc(dbInstance, getUserBasePath(userId)), {
            ...settings,
            updatedAt: new Date()
        }, { merge: true });
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        throw new Error('Erro ao salvar configurações');
    }
}

/**
 * Carrega configurações do usuário
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function loadUserSettings(userId) {
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const userDoc = await getDoc(doc(dbInstance, getUserBasePath(userId)));
        return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        return null;
    }
}
