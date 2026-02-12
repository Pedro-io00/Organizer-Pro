import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Importar módulos personalizados
import * as Utils from './js/utils.js';
import * as AuthModule from './js/auth.js';
import * as DB from './js/database.js';
import * as Config from './js/config.js';
import { validateWeight } from './js/validators.js';

// Configuração Firebase
const firebaseConfig = Config.getFirebaseConfig();
if (!firebaseConfig) {
    alert('Erro: Configuração do Firebase não encontrada');
    throw new Error('Firebase config missing');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = Config.getAppId();

// Inicializar módulos
AuthModule.initAuth(auth);
DB.initDatabase(db);
Utils.setupConnectivityListener();

// Estado da aplicação
let user = null;
let pomoSeconds = Config.APP_CONFIG.POMODORO_DURATION;
let pomoActive = false;
let pomoInterval = null;
let userWeight = Config.APP_CONFIG.DEFAULT_WEIGHT;
let waterGoalL = Config.APP_CONFIG.DEFAULT_WATER_GOAL;
let currentTaskForSubtasks = null;
let currentCalendarDate = new Date();
window.calendarEvents = [];

// Dados para gráficos
let allTasks = [];
let dailyStats = {};

// ==================== AUTENTICAÇÃO ====================

onAuthStateChanged(auth, async (u) => {
    user = u;
    AuthModule.setCurrentUser(u);
    
    if (user) {
        try {
            const settings = await DB.loadUserSettings(user.uid);
            if (settings?.weight) {
                userWeight = settings.weight;
                waterGoalL = settings.waterGoal || parseFloat(((settings.weight * 35) / 1000).toFixed(1));
            }
            
            // Carregar preferência de tema
            if (settings?.darkMode) {
                document.body.classList.add('dark-mode');
                const icon = document.querySelector('#dark-mode-toggle i');
                if (icon) {
                    icon.setAttribute('data-lucide', 'sun');
                    lucide.createIcons();
                }
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').classList.remove('hidden');
        updateUserDisplay();
        setupDatabaseSync();
        
        // Carregar frases do dia
        try {
            await loadQuotePreferences();
        } catch (error) {
            console.error('Erro ao carregar frases:', error);
        }
        
        // Inicializar gráficos após login
        setTimeout(() => {
            try {
                updateDashboardCharts();
            } catch (error) {
                console.error('Erro ao atualizar gráficos:', error);
            }
        }, 500);
    } else {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('main-app').classList.add('hidden');
    }
});

// Timeout de segurança para esconder loading
setTimeout(() => {
    const loadingEl = document.getElementById('loading');
    if (loadingEl && loadingEl.style.display !== 'none') {
        console.warn('Loading timeout - forçando ocultação');
        loadingEl.style.display = 'none';
        const authScreen = document.getElementById('auth-screen');
        if (authScreen) authScreen.style.display = 'flex';
    }
}, 3000);

// Handlers de Autenticação
window.handleLogin = async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        Utils.showMessage('Preencha todos os campos', 'auth-error');
        return;
    }
    
    try {
        await AuthModule.loginWithEmail(email, password);
        Utils.showToast(Config.MESSAGES.AUTH_LOGIN_SUCCESS, 'success');
    } catch (error) {
        Utils.showMessage(error.message, 'auth-error');
    }
};

window.handleRegister = async () => {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    if (!name || !email || !password) {
        Utils.showMessage('Preencha todos os campos', 'register-error');
        return;
    }
    
    try {
        await AuthModule.registerWithEmail(name, email, password);
        Utils.showToast('Conta criada com sucesso!', 'success');
    } catch (error) {
        Utils.showMessage(error.message, 'register-error');
    }
};

window.handleAnonymousLogin = async () => {
    try {
        await AuthModule.loginAnonymously();
        Utils.showToast('Entrando como convidado...', 'info');
    } catch (error) {
        Utils.showMessage(error.message, 'auth-error');
    }
};

window.handleGoogleLogin = async (e) => {
    const btn = e?.target?.closest('button');
    if (btn) btn.disabled = true;
    
    try {
        const result = await AuthModule.loginWithGoogle();
        if (result) Utils.showToast('Login com Google realizado!', 'success');
    } catch (error) {
        if (error.message) Utils.showMessage(error.message, 'auth-error');
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.handleAppleLogin = async (e) => {
    const btn = e?.target?.closest('button');
    if (btn) btn.disabled = true;
    
    try {
        const result = await AuthModule.loginWithApple();
        if (result) Utils.showToast('Login com Apple realizado!', 'success');
    } catch (error) {
        if (error.message) Utils.showMessage(error.message, 'auth-error');
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.handleForgotPassword = async () => {
    const email = document.getElementById('login-email').value.trim();
    if (!email) {
        Utils.showMessage('Digite seu email primeiro', 'auth-error');
        return;
    }
    
    try {
        await AuthModule.sendPasswordReset(email);
        Utils.showMessage(Config.MESSAGES.AUTH_PASSWORD_RESET_SENT, 'auth-error', 'success');
    } catch (error) {
        Utils.showMessage(error.message, 'auth-error');
    }
};

window.handleLogout = async () => {
    if (confirm(Config.MESSAGES.AUTH_LOGOUT_CONFIRM)) {
        try {
            await AuthModule.logout();
            Utils.showToast('Logout realizado', 'info');
        } catch (error) {
            Utils.showToast('Erro ao sair', 'error');
        }
    }
};

window.showLoginForm = () => {
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('auth-error').classList.add('hidden');
    document.getElementById('register-error').classList.add('hidden');
};

window.showRegisterForm = () => {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('auth-error').classList.add('hidden');
    document.getElementById('register-error').classList.add('hidden');
};

window.checkPasswordStrength = () => {
    const password = document.getElementById('register-password').value;
    AuthModule.updatePasswordStrengthUI(password, 'password-strength-bar', 'password-strength-text');
};

function updateUserDisplay() {
    const firstName = AuthModule.getUserFirstName(user);
    const greeting = AuthModule.getGreeting();
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) {
        greetingEl.innerHTML = `${greeting}, <span class="text-indigo-600">${Utils.sanitizeHTML(firstName)}</span>`;
    }
}

// ==================== ÁGUA ====================

window.addWater = async (ml) => {
    if (!user) return;
    
    try {
        await DB.addWater(user.uid, ml);
        
        // Feedback visual nos botões
        const buttons = document.querySelectorAll('[onclick^="addWater"]');
        buttons.forEach(btn => {
            if (btn.getAttribute('onclick').includes(`(${ml})`)) {
                btn.classList.add('animate-pulse');
                setTimeout(() => btn.classList.remove('animate-pulse'), 600);
            }
        });
        
        Utils.showToast(`+${ml}ml adicionado`, 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.openWeightModal = () => {
    const modal = document.getElementById('weight-modal');
    const input = document.getElementById('weight-input');
    input.value = userWeight;
    updateWeightPreview();
    modal.classList.remove('hidden');
    setTimeout(() => {
        input.focus();
        lucide.createIcons();
    }, 100);
};

window.closeWeightModal = () => {
    document.getElementById('weight-modal').classList.add('hidden');
};

window.updateWeightPreview = () => {
    const input = document.getElementById('weight-input');
    const preview = document.getElementById('weight-preview');
    const weight = parseFloat(input.value);
    
    const validation = validateWeight(weight);
    if (validation.valid) {
        const goalMl = weight * 35;
        const goalL = (goalMl / 1000).toFixed(1);
        preview.textContent = `Meta diária: ${goalL}L (${goalMl}ml)`;
        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }
};

window.saveWeight = async () => {
    const input = document.getElementById('weight-input');
    const weight = parseFloat(input.value);
    
    const validation = validateWeight(weight);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }
    
    if (!user) {
        alert('Você precisa estar logado');
        return;
    }
    
    try {
        userWeight = weight;
        waterGoalL = parseFloat(((weight * 35) / 1000).toFixed(1));
        
        await DB.saveUserSettings(user.uid, {
            weight: weight,
            waterGoal: waterGoalL
        });
        
        closeWeightModal();
        Utils.showToast(`✅ Peso atualizado! Nova meta: ${waterGoalL}L por dia`, 'success');
        
        // Atualizar UI imediatamente
        const statsRef = doc(db, `artifacts/${appId}/users/${user.uid}/daily/stats`);
        const snap = await statsRef.get();
        if (snap.exists()) updateStatsUI(snap.data());
    } catch (error) {
        Utils.showToast('Erro ao salvar configuração', 'error');
    }
};

// ==================== TAREFAS ====================

window.handleAddTask = async () => {
    const input = document.getElementById('task-input');
    const priority = document.getElementById('task-priority').value;
    const text = input.value.trim();
    
    if (!text || !user) return;
    
    try {
        await DB.addTask(user.uid, text, priority);
        input.value = '';
        Utils.showToast('Tarefa adicionada', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.toggleTask = async (id, currentStatus) => {
    if (!user) return;
    try {
        await DB.toggleTaskComplete(user.uid, id, currentStatus);
        // Atualizar gráficos após marcar/desmarcar tarefa
        setTimeout(() => updateDashboardCharts(), 300);
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.deleteTask = async (id) => {
    if (!user) return;
    if (!confirm('Excluir esta tarefa?')) return;
    
    try {
        await DB.deleteTask(user.uid, id);
        Utils.showToast('Tarefa excluída', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

// ==================== SUBTAREFAS ====================

window.openSubtaskModal = (taskId, taskText) => {
    currentTaskForSubtasks = taskId;
    document.getElementById('subtask-modal-title').innerText = taskText;
    document.getElementById('subtask-modal').classList.remove('hidden');
    loadSubtasks(taskId);
};

window.closeSubtaskModal = () => {
    document.getElementById('subtask-modal').classList.add('hidden');
    currentTaskForSubtasks = null;
};

window.handleAddSubtask = async () => {
    const input = document.getElementById('subtask-input');
    const text = input.value.trim();
    
    if (!text || !currentTaskForSubtasks || !user) return;
    
    try {
        await DB.addSubtask(user.uid, currentTaskForSubtasks, text);
        input.value = '';
        Utils.showToast('Subtarefa adicionada', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.toggleSubtask = async (subtaskId, currentStatus) => {
    if (!currentTaskForSubtasks || !user) return;
    try {
        await DB.toggleSubtaskComplete(user.uid, currentTaskForSubtasks, subtaskId, currentStatus);
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.deleteSubtask = async (subtaskId) => {
    if (!currentTaskForSubtasks || !user) return;
    try {
        await DB.deleteSubtask(user.uid, currentTaskForSubtasks, subtaskId);
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

function loadSubtasks(taskId) {
    if (!user) return;
    onSnapshot(collection(db, `artifacts/${appId}/users/${user.uid}/tasks/${taskId}/subtasks`), (snap) => {
        const subtasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSubtasksUI(subtasks);
    });
}

// ==================== COMPRAS ====================

window.handleAddShopping = async () => {
    const input = document.getElementById('shop-input');
    const name = input.value.trim();
    
    if (!name || !user) return;
    
    try {
        await DB.addShoppingItem(user.uid, name);
        input.value = '';
        Utils.showToast('Item adicionado', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.toggleShopping = async (id, currentStatus) => {
    if (!user) return;
    try {
        await DB.toggleShoppingItem(user.uid, id, currentStatus);
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.deleteShopping = async(id) => {
    if (!user) return;
    try {
        await DB.deleteShoppingItem(user.uid, id);
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.clearBoughtItems = async () => {
    if (!user) return;
    if (!confirm('Limpar todos os itens comprados?')) return;
    
    try {
        const count = await DB.clearBoughtItems(user.uid);
        Utils.showToast(`${count} ${count === 1 ? 'item removido' : 'itens removidos'}`, 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

// ==================== FINANÇAS ====================

window.handleAddFinance = async () => {
    const desc = document.getElementById('fin-desc');
    const val = document.getElementById('fin-val');
    const description = desc.value.trim();
    const amount = parseFloat(val.value);
    
    if (!description || isNaN(amount) || !user) return;
    
    try {
        await DB.addTransaction(user.uid, description, amount);
        desc.value = '';
        val.value = '';
        Utils.showToast('Transação registrada', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.deleteFinance = async (id) => {
    if (!user) return;
    if (!confirm('Excluir esta transação?')) return;
    
    try {
        await DB.deleteTransaction(user.uid, id);
        Utils.showToast('Transação excluída', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

// ==================== NOTAS ====================

window.handleSaveNote = async () => {
    const input = document.getElementById('note-input');
    const content = input.value.trim();
    
    if (!content || !user) return;
    
    try {
        await DB.addNote(user.uid, content);
        input.value = '';
        Utils.showToast('Nota salva', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.deleteNote = async (id) => {
    if (!user) return;
    if (!confirm('Excluir esta nota?')) return;
    
    try {
        await DB.deleteNote(user.uid, id);
        Utils.showToast('Nota excluída', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

// ==================== HÁBITOS ====================

window.handleAddHabit = async () => {
    const input = document.getElementById('habit-input');
    const name = input.value.trim();
    
    if (!name || !user) return;
    
    try {
        await DB.addHabit(user.uid, name);
        input.value = '';
        Utils.showToast('Hábito adicionado', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.toggleHabitToday = async (id, completedDates) => {
    if (!user) return;
    try {
        await DB.toggleHabitToday(user.uid, id, completedDates);
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.deleteHabit = async (id) => {
    if (!user) return;
    if (!confirm('Excluir este hábito?')) return;
    
    try {
        await DB.deleteHabit(user.uid, id);
        Utils.showToast('Hábito excluído', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

// ==================== METAS ====================

window.handleAddGoal = async () => {
    const title = document.getElementById('goal-title');
    const desc = document.getElementById('goal-desc');
    const period = document.getElementById('goal-period').value;
    const titleText = title.value.trim();
    
    if (!titleText || !user) return;
    
    try {
        await DB.addGoal(user.uid, titleText, desc.value.trim(), period);
        title.value = '';
        desc.value = '';
        Utils.showToast('Meta criada', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.updateGoalProgress = async (id, progress) => {
    if (!user) return;
    try {
        await DB.updateGoalProgress(user.uid, id, progress);
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.deleteGoal = async (id) => {
    if (!user) return;
    if (!confirm('Excluir esta meta?')) return;
    
    try {
        await DB.deleteGoal(user.uid, id);
        Utils.showToast('Meta excluída', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

// ==================== EVENTOS & CALENDÁRIO ====================

window.handleAddEvent = async () => {
    const title = document.getElementById('event-title');
    const date = document.getElementById('event-date');
    const time = document.getElementById('event-time');
    const titleText = title.value.trim();
    
    if (!titleText || !date.value || !user) return;
    
    try {
        await DB.addEvent(user.uid, titleText, date.value, time.value);
        title.value = '';
        date.value = '';
        time.value = '';
        Utils.showToast('Evento adicionado', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.deleteEvent = async (id) => {
    if (!user) return;
    try {
        await DB.deleteEvent(user.uid, id);
        Utils.showToast('Evento excluído', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
};

window.changeMonth = (delta) => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
};

// ==================== POMODORO ====================

window.togglePomodoro = () => {
    pomoActive = !pomoActive;
    const btn = document.getElementById('pomo-btn');
    const resetBtn = document.getElementById('pomo-reset-btn');
    const skipBtn = document.getElementById('pomo-skip-btn');
    const indicator = document.getElementById('pomo-status-indicator');
    
    btn.innerHTML = pomoActive ? '<i data-lucide="pause" class="w-8 h-8"></i>' : '<i data-lucide="play" class="w-8 h-8"></i>';
    lucide.createIcons();

    if (pomoActive) {
        // Ativar indicador visual
        if (indicator) indicator.className = 'w-3 h-3 rounded-full bg-green-400 animate-pulse';
        if (resetBtn) resetBtn.disabled = false;
        if (skipBtn) skipBtn.disabled = false;
        
        pomoInterval = setInterval(async () => {
            pomoSeconds--;
            renderPomoClock();
            updatePomoProgress();
            
            if (pomoSeconds <= 0) {
                clearInterval(pomoInterval);
                pomoActive = false;
                pomoSeconds = Config.APP_CONFIG.POMODORO_DURATION;
                renderPomoClock();
                updatePomoProgress();
                btn.innerHTML = '<i data-lucide="play" class="w-8 h-8"></i>';
                if (indicator) indicator.className = 'w-3 h-3 rounded-full bg-white/30';
                if (resetBtn) resetBtn.disabled = true;
                if (skipBtn) skipBtn.disabled = true;
                lucide.createIcons();
                
                // Animação de conclusão
                const circle = document.getElementById('pomo-progress-circle');
                if (circle) {
                    circle.classList.add('text-green-400');
                    setTimeout(() => circle.classList.remove('text-green-400'), 2000);
                }
                
                Utils.showToast('🎉 Pomodoro completo! Faça uma pausa.', 'success');
                
                if (user) {
                    try {
                        await DB.updateFocusStats(user.uid, 25, 1);
                    } catch (error) {
                        console.error('Erro ao atualizar stats:', error);
                    }
                }
            }
        }, 1000);
    } else {
        clearInterval(pomoInterval);
        if (indicator) indicator.className = 'w-3 h-3 rounded-full bg-yellow-400';
        if (resetBtn) resetBtn.disabled = false;
        if (skipBtn) skipBtn.disabled = false;
    }
};

window.resetPomodoro = () => {
    if (pomoInterval) clearInterval(pomoInterval);
    pomoActive = false;
    pomoSeconds = Config.APP_CONFIG.POMODORO_DURATION;
    
    const btn = document.getElementById('pomo-btn');
    const resetBtn = document.getElementById('pomo-reset-btn');
    const skipBtn = document.getElementById('pomo-skip-btn');
    const indicator = document.getElementById('pomo-status-indicator');
    
    btn.innerHTML = '<i data-lucide="play" class="w-8 h-8"></i>';
    if (indicator) indicator.className = 'w-3 h-3 rounded-full bg-white/30';
    if (resetBtn) resetBtn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;
    
    renderPomoClock();
    updatePomoProgress();
    lucide.createIcons();
    
    Utils.showToast('⏱️ Timer reiniciado', 'info');
};

window.skipPomodoro = async () => {
    if (pomoInterval) clearInterval(pomoInterval);
    pomoActive = false;
    pomoSeconds = Config.APP_CONFIG.POMODORO_DURATION;
    
    const btn = document.getElementById('pomo-btn');
    const resetBtn = document.getElementById('pomo-reset-btn');
    const skipBtn = document.getElementById('pomo-skip-btn');
    const indicator = document.getElementById('pomo-status-indicator');
    
    btn.innerHTML = '<i data-lucide="play" class="w-8 h-8"></i>';
    if (indicator) indicator.className = 'w-3 h-3 rounded-full bg-white/30';
    if (resetBtn) resetBtn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;
    
    renderPomoClock();
    updatePomoProgress();
    lucide.createIcons();
    
    Utils.showToast('⏭️ Sessão pulada', 'info');
};

function renderPomoClock() {
    const m = Math.floor(pomoSeconds / 60);
    const s = pomoSeconds % 60;
    const timeStr = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    
    // Atualizar timer principal (página Foco)
    const mainDisplay = document.getElementById('pomo-display');
    if (mainDisplay) mainDisplay.innerText = timeStr;
    
    // Atualizar timer da sidebar
    const sidebarDisplay = document.getElementById('pomo-display-sidebar');
    if (sidebarDisplay) sidebarDisplay.innerText = timeStr;
}

function updatePomoProgress() {
    const totalSeconds = Config.APP_CONFIG.POMODORO_DURATION;
    const percentage = pomoSeconds / totalSeconds;
    const circumference = 2 * Math.PI * 130; // raio = 130 para página Foco
    const offset = circumference * (1 - percentage);
    
    const circle = document.getElementById('pomo-progress-circle');
    if (circle) {
        circle.style.strokeDashoffset = offset;
        
        // Mudar cor conforme progresso
        if (percentage > 0.5) {
            circle.classList.remove('text-yellow-400', 'text-orange-400', 'text-red-400');
            circle.classList.add('text-white');
        } else if (percentage > 0.25) {
            circle.classList.remove('text-white', 'text-orange-400', 'text-red-400');
            circle.classList.add('text-yellow-400');
        } else if (percentage > 0.1) {
            circle.classList.remove('text-white', 'text-yellow-400', 'text-red-400');
            circle.classList.add('text-orange-400');
        } else {
            circle.classList.remove('text-white', 'text-yellow-400', 'text-orange-400');
            circle.classList.add('text-red-400');
        }
    }
}

// ==================== SINCRONIZAÇÃO EM TEMPO REAL ====================

function setupDatabaseSync() {
    if (!user) return;

    const basePath = `artifacts/${appId}/users/${user.uid}`;

    // Tarefas
    onSnapshot(collection(db, basePath, 'tasks'), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        allTasks = data; // Armazenar para gráficos
        renderTasksUI(data);
        updateDashboardCharts(); // Atualizar gráficos quando tarefas mudarem
    });

    // Compras
    onSnapshot(collection(db, basePath, 'shopping'), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderShoppingUI(data);
    });

    // Finanças
    onSnapshot(collection(db, basePath, 'finance'), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFinanceUI(data);
    });

    // Notas
    onSnapshot(collection(db, basePath, 'notes'), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderNotesUI(data);
    });

    // Hábitos
    onSnapshot(collection(db, basePath, 'habits'), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderHabitsUI(data);
    });

    // Metas
    onSnapshot(collection(db, basePath, 'goals'), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderGoalsUI(data);
    });

    // Eventos
    onSnapshot(collection(db, basePath, 'events'), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        window.calendarEvents = data;
        renderCalendar();
        renderUpcomingEvents(data);
    });

    // Estatísticas Diárias
    const statsRef = doc(db, basePath, 'daily', 'stats');
    onSnapshot(statsRef, async (snap) => {
        if (snap.exists()) {
            updateStatsUI(snap.data());
        } else {
            await setDoc(statsRef, { water: 0, focusMinutes: 0, cycles: 0 });
        }
    });
}

// ==================== RENDERIZAÇÃO DE UI ====================

function renderTasksUI(tasks) {
    const list = document.getElementById('full-tasks');
    const dash = document.getElementById('dash-tasks');
    if (!list || !dash) return;
    
    list.innerHTML = '';
    dash.innerHTML = '';
    
    tasks.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).forEach(t => {
        const priorityColors = {
            high: 'text-rose-500',
            medium: 'text-amber-500',
            low: 'text-emerald-500'
        };
        
        const html = `
            <li class="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 group transition-all hover:shadow-md ${t.completed ? 'opacity-50' : ''}">
                <div class="flex items-center gap-4 flex-1" onclick="openSubtaskModal('${t.id}', '${Utils.sanitizeHTML(t.text).replace(/'/g, "\\'")}');" style="cursor: pointer;" role="button" tabindex="0" aria-label="Abrir subtarefas">
                    <button onclick="event.stopPropagation(); toggleTask('${t.id}', ${t.completed})" class="w-6 h-6 rounded-lg border-2 flex items-center justify-center ${t.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200'}" aria-label="${t.completed ? 'Desmarcar tarefa' : 'Marcar tarefa como concluída'}">
                        ${t.completed ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}
                    </button>
                    <div>
                        <p class="text-sm font-bold ${t.completed ? 'line-through text-slate-400' : 'text-slate-800'}">${Utils.sanitizeHTML(t.text)}</p>
                        <span class="text-[9px] font-black uppercase tracking-widest ${priorityColors[t.priority] || 'text-slate-400'}">${t.priority}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="openSubtaskModal('${t.id}', '${Utils.sanitizeHTML(t.text).replace(/'/g, "\\'")}')" class="text-slate-300 hover:text-indigo-500 transition-all" title="Subtarefas" aria-label="Gerenciar subtarefas">
                        <i data-lucide="list" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteTask('${t.id}')" class="text-slate-300 hover:text-rose-500 transition-all" aria-label="Excluir tarefa">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </li>`;
        list.innerHTML += html;
        if (!t.completed) dash.innerHTML += html;
    });
    
    const pendingCount = tasks.filter(x => !x.completed).length;
    const countEl = document.getElementById('dash-tasks-count');
    if (countEl) countEl.innerText = pendingCount;
    
    lucide.createIcons();
}

function renderSubtasksUI(subtasks) {
    const list = document.getElementById('subtask-list');
    if (!list) return;
    
    list.innerHTML = subtasks.length ? '' : '<p class="text-sm text-slate-400 text-center py-8">Nenhuma subtarefa ainda</p>';
    
    subtasks.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).forEach(st => {
        list.innerHTML += `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div class="flex items-center gap-3 flex-1">
                    <button onclick="toggleSubtask('${st.id}', ${st.completed})" class="w-5 h-5 rounded border-2 flex items-center justify-center ${st.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}" aria-label="${st.completed ? 'Desmarcar' : 'Marcar como feito'}">
                        ${st.completed ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}
                    </button>
                    <span class="text-sm ${st.completed ? 'line-through text-slate-400' : 'text-slate-700'}">${Utils.sanitizeHTML(st.text)}</span>
                </div>
                <button onclick="deleteSubtask('${st.id}')" class="text-slate-300 hover:text-rose-500" aria-label="Excluir subtarefa">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>`;
    });
    lucide.createIcons();
}

function renderShoppingUI(items) {
    const list = document.getElementById('shopping-list-container');
    const dash = document.getElementById('dash-shopping');
    if (!list || !dash) return;
    
    list.innerHTML = '';
    dash.innerHTML = '';

    items.forEach(item => {
        const html = `
            <div class="flex items-center justify-between gap-3 p-3 rounded-xl border ${item.bought ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}">
                <div class="flex items-center gap-3">
                    <input type="checkbox" ${item.bought ? 'checked' : ''} onchange="toggleShopping('${item.id}', ${item.bought})" class="w-4 h-4 rounded text-indigo-600" aria-label="${item.bought ? 'Desmarcar item' : 'Marcar como comprado'}">
                    <span class="text-sm font-medium ${item.bought ? 'shopping-item-done text-slate-400' : 'text-slate-700'}">${Utils.sanitizeHTML(item.name)}</span>
                </div>
                <button onclick="deleteShopping('${item.id}')" class="text-slate-300 hover:text-rose-500" aria-label="Remover item">
                    <i data-lucide="x" class="w-3 h-3"></i>
                </button>
            </div>`;
        list.innerHTML += html;
        if (!item.bought) dash.innerHTML += html;
    });
    lucide.createIcons();
}

function renderFinanceUI(txs) {
    const list = document.getElementById('finance-list');
    if (!list) return;
    
    list.innerHTML = '';
    let bal = 0, exp = 0;
    
    txs.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
        bal += t.amount;
        if (t.amount < 0) exp += Math.abs(t.amount);
        
        list.innerHTML += `
            <tr class="border-b border-slate-50 group">
                <td class="py-4 text-slate-400 text-xs">${Utils.formatDate(new Date(t.date))}</td>
                <td class="py-4 font-bold text-slate-700">${Utils.sanitizeHTML(t.desc)}</td>
                <td class="py-4 text-right font-black ${t.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${t.amount.toFixed(2)}€</td>
                <td class="py-4 text-right">
                    <button onclick="deleteFinance('${t.id}')" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" aria-label="Excluir transação">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>`;
    });
    
    const balEl = document.getElementById('dash-balance');
    const expEl = document.getElementById('dash-expenses');
    if (balEl) balEl.innerText = `${bal.toFixed(2)}€`;
    if (expEl) expEl.innerText = `${exp.toFixed(2)}€`;
    
    lucide.createIcons();
}

function renderNotesUI(notes) {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    notes.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).forEach(n => {
        const dateStr = n.createdAt ? Utils.formatDate(new Date(n.createdAt.seconds * 1000)) : 'A guardar...';
        grid.innerHTML += `
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm break-inside-avoid group mb-4">
                <p class="text-sm text-slate-600 leading-relaxed mb-4">${Utils.sanitizeHTML(n.content)}</p>
                <div class="flex justify-between items-center opacity-40 group-hover:opacity-100 transition-opacity">
                    <span class="text-[9px] font-bold text-slate-300">${dateStr}</span>
                    <button onclick="deleteNote('${n.id}')" class="text-rose-400" aria-label="Excluir nota">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </div>
            </div>`;
    });
    lucide.createIcons();
}

function renderHabitsUI(habits) {
    const grid = document.getElementById('habits-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    
    habits.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).forEach(h => {
        const isDoneToday = (h.completedDates || []).includes(today);
        const progress = Math.min((h.streak || 0) * 10, 100);
        
        grid.innerHTML += `
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group">
                <div class="flex justify-between items-start mb-4">
                    <h4 class="font-bold text-slate-800">${Utils.sanitizeHTML(h.name)}</h4>
                    <button onclick="deleteHabit('${h.id}')" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" aria-label="Excluir hábito">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="flex items-center gap-3 mb-4">
                    <div class="flex-1 bg-slate-100 rounded-full p-1">
                        <div class="bg-indigo-600 h-2 rounded-full transition-all" style="width: ${progress}%"></div>
                    </div>
                    <span class="text-xs font-bold text-indigo-600">${h.streak || 0} dias</span>
                </div>
                <button onclick='toggleHabitToday("${h.id}", ${JSON.stringify(h.completedDates || [])})' 
                    class="w-full py-3 rounded-xl font-bold transition-all ${isDoneToday ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}" aria-label="${isDoneToday ? 'Desmarcar hábito de hoje' : 'Marcar hábito como feito hoje'}">
                    ${isDoneToday ? '✓ Completo Hoje' : 'Marcar como Feito'}
                </button>
            </div>`;
    });
    lucide.createIcons();
}

function renderGoalsUI(goals) {
    const list = document.getElementById('goals-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    goals.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).forEach(g => {
        const periodEmoji = {semanal: '📅', mensal: '📆', trimestral: '🗓️', anual: '🎯'}[g.period] || '📋';
        const periodLabel = g.period.charAt(0).toUpperCase() + g.period.slice(1);
        
        list.innerHTML += `
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold text-slate-800 mb-1">${Utils.sanitizeHTML(g.title)}</h4>
                        <p class="text-xs text-slate-500">${periodEmoji} ${periodLabel}</p>
                    </div>
                    <button onclick="deleteGoal('${g.id}')" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" aria-label="Excluir meta">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                ${g.description ? `<p class="text-sm text-slate-600 mb-4">${Utils.sanitizeHTML(g.description)}</p>` : ''}
                <div class="mb-3">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-xs font-bold text-slate-400">Progresso</span>
                        <span class="text-sm font-black text-indigo-600">${g.progress || 0}%</span>
                    </div>
                    <div class="bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div class="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500" style="width: ${g.progress || 0}%"></div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="updateGoalProgress('${g.id}', ${(g.progress || 0) - 10})" class="flex-1 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm font-bold" aria-label="Diminuir progresso">-10%</button>
                    <button onclick="updateGoalProgress('${g.id}', ${(g.progress || 0) + 10})" class="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold" aria-label="Aumentar progresso">+10%</button>
                </div>
            </div>`;
    });
    lucide.createIcons();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthLabel = document.getElementById('calendar-month');
    if (!grid || !monthLabel) return;
    
    monthLabel.innerText = currentCalendarDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().toISOString().split('T')[0];
    
    grid.innerHTML = '';
    
    // Dias vazios antes do início do mês
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += '<div class="aspect-square"></div>';
    }
    
    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasEvent = (window.calendarEvents || []).some(e => e.date === dateStr);
        const isToday = dateStr === today;
        
        grid.innerHTML += `
            <div class="aspect-square p-2 rounded-xl border ${isToday ? 'bg-indigo-50 border-indigo-300 font-black' : 'border-slate-100 hover:bg-slate-50'} flex flex-col items-center justify-center cursor-pointer transition-all group" role="button" tabindex="0" aria-label="Dia ${day}">
                <span class="text-sm ${isToday ? 'text-indigo-600' : 'text-slate-700'}">${day}</span>
                ${hasEvent ? '<div class="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1"></div>' : ''}
            </div>`;
    }
    lucide.createIcons();
}

function renderUpcomingEvents(events) {
    const container = document.getElementById('upcoming-events');
    if (!container) return;
    
    const sorted = events
        .filter(e => new Date(e.date) >= new Date())
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
    
    container.innerHTML = sorted.length ? sorted.map(e => `
        <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg group">
            <div class="flex-1">
                <p class="text-xs font-bold text-slate-700">${Utils.sanitizeHTML(e.title)}</p>
                <p class="text-[10px] text-slate-400">${Utils.formatDate(new Date(e.date))} ${e.time ? `• ${e.time}` : ''}</p>
            </div>
            <button onclick="deleteEvent('${e.id}')" class="opacity-0 group-hover:opacity-100 text-rose-400" aria-label="Excluir evento">
                <i data-lucide="x" class="w-3 h-3"></i>
            </button>
        </div>
    `).join('') : '<p class="text-xs text-slate-400 text-center py-4">Nenhum evento agendado</p>';
    
    lucide.createIcons();
}

function updateStatsUI(data) {
    const waterMl = data.water || 0;
    const waterL = (waterMl / 1000).toFixed(1);
    const goalL = waterGoalL;
    const percentage = Math.min((waterMl / (goalL * 1000)) * 100, 100);
    const remaining = Math.max((goalL * 1000) - waterMl, 0);
    
    const dashWater = document.getElementById('dash-water');
    if (dashWater) dashWater.innerText = `${waterL} / ${goalL}L`;
    
    // Atualizar barra de progresso
    const progressBar = document.getElementById('water-progress-bar');
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        
        // Celebração quando atingir 100%
        if (percentage >= 100) {
            const widget = progressBar.closest('.bg-white');
            widget?.classList.add('water-complete');
            setTimeout(() => widget?.classList.remove('water-complete'), 600);
            
            // Mostrar toast apenas uma vez
            if (!progressBar.dataset.celebrated) {
                Utils.showToast(Config.MESSAGES.WATER_GOAL_REACHED, 'success');
                progressBar.dataset.celebrated = 'true';
            }
        } else {
            delete progressBar.dataset.celebrated;
        }
    }
    
    // Atualizar sugestão
    const suggestionEl = document.getElementById('water-suggestion');
    if (suggestionEl) {
        const glasses250ml = Math.ceil(remaining / 250);
        let suggestion = '';
        
        if (percentage === 0) {
            suggestion = '💧 Comece agora! Beba 1 copo de água (250ml)';
        } else if (percentage < 30) {
            suggestion = `👍 Ótimo começo! Faltam ${glasses250ml} ${glasses250ml === 1 ? 'copo' : 'copos'} de 250ml`;
        } else if (percentage < 60) {
            suggestion = `🚀 Você está indo bem! Só mais ${glasses250ml} ${glasses250ml === 1 ? 'copo' : 'copos'}`;
        } else if (percentage < 90) {
            suggestion = `🌟 Quase lá! Apenas ${(remaining / 1000).toFixed(1)}L (${glasses250ml} ${glasses250ml === 1 ? 'copo' : 'copos'})`;
        } else if (percentage < 100) {
            suggestion = `🔥 Último esforço! Só faltam ${remaining}ml`;
        } else {
            suggestion = '🏆 Meta diária alcançada! Parabéns! Continue se hidratando';
        }
        
        suggestionEl.textContent = suggestion;
    }
    
    // Atualizar estatísticas de foco
    const focusTimeEl = document.getElementById('stat-focus-time');
    const dashFocusEl = document.getElementById('dash-focus');
    const pomoCountEl = document.getElementById('stat-pomo-count');
    const focusTimeSidebarEl = document.getElementById('stat-focus-time-sidebar');
    const pomoCountSidebarEl = document.getElementById('stat-pomo-count-sidebar');
    
    if (focusTimeEl) focusTimeEl.innerText = data.focusMinutes || 0;
    if (dashFocusEl) dashFocusEl.innerText = `${data.focusMinutes || 0}m`;
    if (pomoCountEl) pomoCountEl.innerText = `${data.cycles || 0}`;
    if (focusTimeSidebarEl) focusTimeSidebarEl.innerText = data.focusMinutes || 0;
    if (pomoCountSidebarEl) pomoCountSidebarEl.innerText = data.cycles || 0;
    
    // Armazenar stats diários para gráfico
    const today = new Date().toISOString().split('T')[0];
    dailyStats[today] = data;
    
    // Atualizar gráfico quando foco mudar
    if (data.focusMinutes > 0) {
        updateDashboardCharts();
    }
}

// ==================== NAVEGAÇÃO ====================

window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('tab-active'));
    
    const contentEl = document.getElementById(`content-${id}`);
    const tabEl = document.getElementById(`tab-${id}`);
    
    if (contentEl) contentEl.classList.remove('hidden');
    if (tabEl) tabEl.classList.add('tab-active');
    
    if (id === 'calendar') renderCalendar();
    
    // Atualizar gráficos quando acessar dashboard
    if (id === 'dashboard') {
        setTimeout(() => {
            updateDashboardCharts();
        }, 100);
    }
    
    lucide.createIcons();
};

// ==================== FRASES DO DIA ====================

const DAILY_QUOTES = {
    motivacao: [
        { text: "Acredite em você e todo o resto se encaixará.", author: "Napoleon Hill" },
        { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
        { text: "Não espere por oportunidades extraordinárias. Agarre as oportunidades comuns e torne-as grandes.", author: "Orison Swett Marden" },
        { text: "A única maneira de fazer um excelente trabalho é amar o que você faz.", author: "Steve Jobs" },
        { text: "O fracasso é apenas a oportunidade de começar de novo de forma mais inteligente.", author: "Henry Ford" },
        { text: "Cada dia é uma nova oportunidade para mudar sua vida.", author: "Desconhecido" },
        { text: "O maior risco é não correr nenhum risco.", author: "Mark Zuckerberg" },
        { text: "Você é mais forte do que imagina e mais capaz do que pensa.", author: "Desconhecido" },
        { text: "A coragem não é a ausência do medo, mas a vitória sobre ele.", author: "Nelson Mandela" },
        { text: "Comece de onde você está. Use o que você tem. Faça o que você pode.", author: "Arthur Ashe" },
        { text: "Não limite seus desafios. Desafie seus limites.", author: "Desconhecido" },
        { text: "O futuro pertence àqueles que acreditam na beleza de seus sonhos.", author: "Eleanor Roosevelt" },
        { text: "Grandes coisas nunca vêm de zonas de conforto.", author: "Desconhecido" },
        { text: "A persistência é o caminho do êxito.", author: "Charles Chaplin" },
        { text: "Se você pode sonhar, você pode fazer.", author: "Walt Disney" },
        { text: "A vida é 10% o que acontece com você e 90% como você reage.", author: "Charles R. Swindoll" }
    ],
    produtividade: [
        { text: "Foco é a chave para a excelência.", author: "Cal Newport" },
        { text: "Não conte os dias, faça os dias contarem.", author: "Muhammad Ali" },
        { text: "Produtividade não é fazer mais coisas, mas fazer as coisas certas.", author: "Tim Ferriss" },
        { text: "Planeje seu trabalho e trabalhe seu plano.", author: "Napoleon Hill" },
        { text: "A disciplina é a ponte entre objetivos e realizações.", author: "Jim Rohn" },
        { text: "Comece onde você está. Use o que você tem. Faça o que você pode.", author: "Arthur Ashe" },
        { text: "O segredo para avançar é começar.", author: "Mark Twain" },
        { text: "Concentre-se em ser produtivo, não em estar ocupado.", author: "Tim Ferriss" },
        { text: "Faça uma coisa de cada vez e faça-a bem.", author: "Desconhecido" },
        { text: "A perfeição não é alcançável, mas se perseguimos a perfeição podemos alcançar a excelência.", author: "Vince Lombardi" },
        { text: "Você não precisa ver toda a escada. Apenas dê o primeiro passo.", author: "Martin Luther King Jr." },
        { text: "A forma mais eficaz de fazer algo é fazê-lo.", author: "Amelia Earhart" },
        { text: "Se você não sabe por onde começar, comece por qualquer lugar. Só comece.", author: "Desconhecido" },
        { text: "Terminar é melhor que perfeito.", author: "Sheryl Sandberg" },
        { text: "Elimine o desnecessário para que o necessário possa falar.", author: "Hans Hofmann" },
        { text: "O tempo perdido nunca volta. Use-o com sabedoria.", author: "Desconhecido" }
    ],
    saude: [
        { text: "Cuide do seu corpo. É o único lugar que você tem para viver.", author: "Jim Rohn" },
        { text: "A saúde não é tudo, mas sem ela, tudo não é nada.", author: "Arthur Schopenhauer" },
        { text: "Mova-se mais, viva mais.", author: "Desconhecido" },
        { text: "Seu corpo é um templo, mas apenas se você o tratar como um.", author: "Astrid Alauda" },
        { text: "A paz de espírito vem de não querer mudar os outros.", author: "Gerald Jampolsky" },
        { text: "Respire fundo e lembre-se: você está fazendo o melhor que pode.", author: "Desconhecido" },
        { text: "Um corpo saudável é um quarto de hóspedes para a alma.", author: "Francis Bacon" },
        { text: "Hidrate-se, alimente-se bem e descanse. Seu corpo agradece.", author: "Desconhecido" },
        { text: "A mente sã habita em corpo são.", author: "Juvenal" },
        { text: "Dormir bem é uma forma de respeitar a si mesmo.", author: "Desconhecido" },
        { text: "Faça exercícios não porque você odeia seu corpo, mas porque você o ama.", author: "Desconhecido" },
        { text: "Saúde mental é tão importante quanto saúde física. Cuide de ambas.", author: "Desconhecido" },
        { text: "Pausas regulares aumentam sua energia e clareza mental.", author: "Desconhecido" },
        { text: "Você não pode servir de um copo vazio. Cuide-se primeiro.", author: "Desconhecido" },
        { text: "A saúde é a verdadeira riqueza e não peças de ouro e prata.", author: "Mahatma Gandhi" },
        { text: "Medite. Respire. Acalme sua mente. Você merece paz.", author: "Desconhecido" }
    ],
    crescimento: [
        { text: "Aprendizado contínuo é o mínimo necessário para o sucesso.", author: "Brian Tracy" },
        { text: "Invista em você mesmo. Você é seu melhor ativo.", author: "Warren Buffett" },
        { text: "A educação é a arma mais poderosa que você pode usar para mudar o mundo.", author: "Nelson Mandela" },
        { text: "Quanto mais você aprende, mais você ganha.", author: "Warren Buffett" },
        { text: "Seja sempre uma versão melhor de si mesmo.", author: "Desconhecido" },
        { text: "O crescimento começa no fim da sua zona de conforto.", author: "Desconhecido" },
        { text: "Leia 30 minutos por dia e transforme sua vida.", author: "Desconhecido" },
        { text: "Aprenda com ontem, viva para hoje, tenha esperança para amanhã.", author: "Albert Einstein" },
        { text: "O único investimento que nunca falha é o investimento em conhecimento.", author: "Benjamin Franklin" },
        { text: "Não pare quando estiver cansado. Pare quando tiver terminado.", author: "Desconhecido" },
        { text: "A única pessoa que você está destinado a se tornar é a pessoa que você decide ser.", author: "Ralph Waldo Emerson" },
        { text: "Falhar é aprender. Aprender é crescer.", author: "Desconhecido" },
        { text: "Cada expert foi uma vez um iniciante. Nunca desista.", author: "Desconhecido" },
        { text: "O sucesso vem para aqueles que têm a mentalidade de crescimento, não de limitação.", author: "Carol Dweck" },
        { text: "Desenvolva habilidades que ninguém pode tirar de você.", author: "Desconhecido" },
        { text: "Uma mente que se abre a uma nova ideia jamais voltará ao seu tamanho original.", author: "Albert Einstein" }
    ],
    gratidao: [
        { text: "Gratidão transforma o que temos em suficiente.", author: "Melody Beattie" },
        { text: "Agradeça pelo que você tem hoje, enquanto persegue o que deseja amanhã.", author: "Desconhecido" },
        { text: "A felicidade não é ter o que você quer, mas querer o que você tem.", author: "Rabbi Hyman Schachtel" },
        { text: "Comece cada dia com um coração grato.", author: "Desconhecido" },
        { text: "A gratidão é a memória do coração.", author: "Jean Baptiste Massieu" },
        { text: "Celebre suas pequenas vitórias. Elas se somam.", author: "Desconhecido" },
        { text: "Seja grato pelo que você é agora e continue lutando pelo que deseja ser amanhã.", author: "Fernanda Mello" },
        { text: "Hoje é um bom dia para ter um bom dia.", author: "Desconhecido" },
        { text: "Aprecie o que você tem antes que se torne o que você tinha.", author: "Desconhecido" },
        { text: "A gratidão muda tudo. Transforme sua atitude em gratitude.", author: "Desconhecido" },
        { text: "Quando você é grato, o medo desaparece e a abundância surge.", author: "Tony Robbins" },
        { text: "Agradecer é reconhecer o bem que há em sua vida.", author: "Desconhecido" },
        { text: "As pequenas coisas? As pequenas coisas não são pequenas.", author: "Jon Kabat-Zinn" },
        { text: "Há sempre algo pelo qual ser grato. Procure e você encontrará.", author: "Desconhecido" },
        { text: "A gratidão é o sinal de almas nobres.", author: "Esopo" },
        { text: "Seja grato não apenas pelas coisas óbvias, mas também pelos desafios que o fazem crescer.", author: "Desconhecido" }
    ]
};

let userQuotePreferences = ['motivacao', 'produtividade'];

// Função para obter frase do dia
function getDailyQuote() {
    if (userQuotePreferences.length === 0) {
        return { 
            text: "Configure suas preferências de frases clicando no ícone de configurações.", 
            category: "Sistema",
            author: "" 
        };
    }
    
    // Usar a data como seed para ter a mesma frase durante todo o dia
    const today = new Date().toISOString().split('T')[0];
    const seed = today.split('-').join('');
    const randomIndex = parseInt(seed) % 1000;
    
    // Selecionar categoria baseada no dia
    const categoryIndex = randomIndex % userQuotePreferences.length;
    const selectedCategory = userQuotePreferences[categoryIndex];
    
    const categoryQuotes = DAILY_QUOTES[selectedCategory];
    const quoteIndex = randomIndex % categoryQuotes.length;
    const quote = categoryQuotes[quoteIndex];
    
    return {
        text: quote.text,
        author: quote.author,
        category: getCategoryName(selectedCategory)
    };
}

function getCategoryName(key) {
    const names = {
        'motivacao': 'Motivação',
        'produtividade': 'Produtividade',
        'saude': 'Saúde & Bem-estar',
        'crescimento': 'Crescimento Pessoal',
        'gratidao': 'Gratidão'
    };
    return names[key] || key;
}

// Exibir frase do dia
function displayDailyQuote() {
    const quote = getDailyQuote();
    const quoteEl = document.getElementById('daily-quote');
    const categoryEl = document.getElementById('quote-category');
    
    if (quoteEl) {
        quoteEl.textContent = `"${quote.text}"`;
        if (quote.author) {
            quoteEl.textContent += ` — ${quote.author}`;
        }
    }
    
    if (categoryEl) {
        categoryEl.textContent = quote.category;
    }
}

// Modal de configurações de frases
window.openQuoteSettings = () => {
    const modal = document.getElementById('quote-settings-modal');
    if (!modal) return;
    
    // Carregar preferências atuais
    userQuotePreferences.forEach(pref => {
        const checkbox = document.getElementById(`cat-${pref}`);
        if (checkbox) checkbox.checked = true;
    });
    
    modal.classList.remove('hidden');
    lucide.createIcons();
};

window.closeQuoteSettings = () => {
    document.getElementById('quote-settings-modal')?.classList.add('hidden');
};

window.saveQuoteSettings = async () => {
    const checkboxes = [
        'cat-motivacao',
        'cat-produtividade', 
        'cat-saude',
        'cat-crescimento',
        'cat-gratidao'
    ];
    
    const selected = checkboxes
        .map(id => {
            const checkbox = document.getElementById(id);
            return checkbox?.checked ? checkbox.value : null;
        })
        .filter(v => v !== null);
    
    if (selected.length === 0) {
        Utils.showToast('Selecione pelo menos uma categoria!', 'error');
        return;
    }
    
    userQuotePreferences = selected;
    
    // Salvar no Firebase
    if (user) {
        try {
            await DB.saveUserSettings(user.uid, {
                quotePreferences: selected
            });
        } catch (error) {
            console.error('Erro ao salvar preferências:', error);
        }
    }
    
    // Salvar no localStorage
    localStorage.setItem('quotePreferences', JSON.stringify(selected));
    
    // Atualizar frase exibida
    displayDailyQuote();
    
    closeQuoteSettings();
    Utils.showToast('Preferências salvas com sucesso!', 'success');
};

// Carregar preferências do Firebase
async function loadQuotePreferences() {
    // Tentar localStorage primeiro
    const savedPrefs = localStorage.getItem('quotePreferences');
    if (savedPrefs) {
        try {
            userQuotePreferences = JSON.parse(savedPrefs);
        } catch (e) {
            console.error('Erro ao carregar preferências do localStorage');
        }
    }
    
    // Carregar do Firebase se usuário logado
    if (user) {
        try {
            const settings = await DB.loadUserSettings(user.uid);
            if (settings?.quotePreferences) {
                userQuotePreferences = settings.quotePreferences;
                localStorage.setItem('quotePreferences', JSON.stringify(settings.quotePreferences));
            }
        } catch (error) {
            console.error('Erro ao carregar preferências do Firebase:', error);
        }
    }
    
    displayDailyQuote();
}

// ==================== DARK MODE ====================

window.toggleDarkMode = () => {
    const body = document.body;
    const isDark = body.classList.toggle('dark-mode');
    
    // Salvar preferência
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    
    // Salvar no Firebase se usuário logado
    if (user) {
        DB.saveUserSettings(user.uid, {
            darkMode: isDark
        }).catch(error => {
            console.error('Erro ao salvar preferência de tema:', error);
        });
    }
    
    // Atualizar ícone
    const icon = document.querySelector('#dark-mode-toggle i');
    if (icon) {
        icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        lucide.createIcons();
    }
    
    // Recriar gráficos com novo tema
    if (isDark) {
        Chart.defaults.color = '#e2e8f0';
    } else {
        Chart.defaults.color = '#64748b';
    }
    
    updateDashboardCharts();
};

// Carregar preferência de tema
function loadThemePreference() {
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme === 'enabled') {
        document.body.classList.add('dark-mode');
        const icon = document.querySelector('#dark-mode-toggle i');
        if (icon) {
            icon.setAttribute('data-lucide', 'sun');
        }
    }
}

// ==================== GRÁFICOS (DASHBOARD) ====================

let weeklyChart = null;
let tasksChart = null;

// Função auxiliar para obter estatísticas de uma data específica
function getTasksCompletedOnDate(targetDate) {
    const dateStr = targetDate.toISOString().split('T')[0];
    return allTasks.filter(task => {
        if (!task.completed || !task.completedAt) return false;
        const taskDate = new Date(task.completedAt.seconds * 1000).toISOString().split('T')[0];
        return taskDate === dateStr;
    }).length;
}

// Função auxiliar para obter minutos de foco de uma data
function getFocusMinutesOnDate(targetDate) {
    const dateStr = targetDate.toISOString().split('T')[0];
    return dailyStats[dateStr]?.focusMinutes || 0;
}

// Função para contar tarefas por status
function getTasksByStatus() {
    const completed = allTasks.filter(t => t.completed).length;
    const inProgress = allTasks.filter(t => !t.completed && t.priority === 'high').length;
    const pending = allTasks.filter(t => !t.completed && t.priority !== 'high').length;
    return { completed, inProgress, pending };
}

function updateDashboardCharts() {
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não carregado ainda');
        return;
    }
    
    if (!user) return;
    
    // Configurar tema dos gráficos
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#475569' : '#cbd5e1';
    
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
    Chart.defaults.font = {
        family: "'Plus Jakarta Sans', sans-serif",
        size: 13,
        weight: '600'
    };
    
    // Gráfico de Progresso Semanal
    const weeklyCtx = document.getElementById('weekly-progress-chart');
    if (weeklyCtx) {
        if (weeklyChart) {
            weeklyChart.destroy();
            weeklyChart = null;
        }
        
        const last7Days = [];
        const tasksCompletedData = [];
        const focusMinutesData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayName = date.toLocaleDateString('pt-PT', { weekday: 'short' });
            last7Days.push(dayName.charAt(0).toUpperCase() + dayName.slice(1));
            
            // Dados REAIS do Firebase
            tasksCompletedData.push(getTasksCompletedOnDate(date));
            focusMinutesData.push(getFocusMinutesOnDate(date));
        }
        
        try {
            const totalTasks = tasksCompletedData.reduce((a, b) => a + b, 0);
            const totalFocus = focusMinutesData.reduce((a, b) => a + b, 0);
            const hasWeeklyData = totalTasks > 0 || totalFocus > 0;
            
            weeklyChart = new Chart(weeklyCtx, {
                type: 'line',
                data: {
                    labels: last7Days,
                    datasets: [
                        {
                            label: 'Tarefas Completadas',
                            data: tasksCompletedData,
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            borderWidth: 3,
                            tension: 0.4,
                            fill: true,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: '#6366f1',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'Minutos de Foco',
                            data: focusMinutesData,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.2)',
                            borderWidth: 3,
                            tension: 0.4,
                            fill: true,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: '#f59e0b',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            display: hasWeeklyData,
                            position: 'top',
                            labels: {
                                color: textColor,
                                usePointStyle: true,
                                padding: 20,
                                font: {
                                    size: 13,
                                    weight: '700'
                                },
                                boxWidth: 8,
                                boxHeight: 8
                            }
                        },
                        tooltip: {
                            backgroundColor: isDark ? '#0f172a' : '#ffffff',
                            titleColor: isDark ? '#f1f5f9' : '#0f172a',
                            bodyColor: isDark ? '#e2e8f0' : '#334155',
                            borderColor: isDark ? '#475569' : '#cbd5e1',
                            borderWidth: 2,
                            padding: 16,
                            displayColors: true,
                            titleFont: {
                                size: 14,
                                weight: '700'
                            },
                            bodyFont: {
                                size: 13,
                                weight: '600'
                            },
                            boxWidth: 10,
                            boxHeight: 10,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += context.parsed.y;
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: gridColor,
                                drawBorder: false
                            },
                            ticks: {
                                color: textColor,
                                padding: 10,
                                font: {
                                    size: 12,
                                    weight: '600'
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: textColor,
                                padding: 10,
                                font: {
                                    size: 12,
                                    weight: '700'
                                }
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'emptyWeeklyMessage',
                    afterDraw: (chart) => {
                        if (!hasWeeklyData) {
                            const ctx = chart.ctx;
                            const width = chart.width;
                            const height = chart.height;
                            
                            ctx.save();
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            
                            // Ajustar tamanho da fonte dinamicamente baseado na largura
                            const fontSize = width < 400 ? 12 : 15;
                            ctx.font = `bold ${fontSize}px Plus Jakarta Sans, sans-serif`;
                            ctx.fillStyle = textColor;
                            
                            if (width < 350) {
                                // Quebrar em duas linhas para telas muito pequenas
                                ctx.fillText('📊 Complete tarefas e', width / 2, height / 2 - 15);
                                ctx.fillText('use o Pomodoro', width / 2, height / 2 + 5);
                                
                                ctx.font = `${fontSize - 2}px Plus Jakarta Sans, sans-serif`;
                                ctx.fillStyle = isDark ? '#64748b' : '#64748b';
                                ctx.fillText('para ver seu progresso', width / 2, height / 2 + 25);
                            } else {
                                ctx.fillText('📊 Complete tarefas e use o Pomodoro', width / 2, height / 2 - 12);
                                ctx.font = `${fontSize - 2}px Plus Jakarta Sans, sans-serif`;
                                ctx.fillStyle = isDark ? '#64748b' : '#64748b';
                                ctx.fillText('para ver seu progresso aqui', width / 2, height / 2 + 12);
                            }
                            
                            ctx.restore();
                        }
                    }
                }]
            });
        } catch (error) {
            console.error('Erro ao criar gráfico semanal:', error);
        }
    }
    
    // Gráfico de Distribuição de Tarefas
    const tasksCtx = document.getElementById('tasks-distribution-chart');
    if (tasksCtx) {
        if (tasksChart) {
            tasksChart.destroy();
            tasksChart = null;
        }
        
        // Obter dados REAIS
        const statusData = getTasksByStatus();
        const hasData = statusData.completed > 0 || statusData.pending > 0 || statusData.inProgress > 0;
        
        try {
            tasksChart = new Chart(tasksCtx, {
                type: 'doughnut',
                data: {
                    labels: hasData ? ['Completadas', 'Pendentes', 'Em Progresso'] : ['Sem tarefas'],
                    datasets: [{
                        data: hasData ? [statusData.completed, statusData.pending, statusData.inProgress] : [1],
                        backgroundColor: hasData ? [
                            '#10b981',
                            '#f59e0b',
                            '#6366f1'
                        ] : ['#cbd5e1'],
                        borderWidth: 6,
                        borderColor: isDark ? '#0f172a' : '#ffffff',
                        hoverOffset: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: textColor,
                                usePointStyle: true,
                                padding: 20,
                                font: {
                                    size: 13,
                                    weight: '700'
                                },
                                boxWidth: 10,
                                boxHeight: 10,
                                generateLabels: (chart) => {
                                    const data = chart.data;
                                    if (!hasData) {
                                        return [{
                                            text: 'Adicione tarefas para ver estatísticas',
                                            fillStyle: '#cbd5e1',
                                            hidden: false,
                                            index: 0,
                                            fontColor: textColor
                                        }];
                                    }
                                    return data.labels.map((label, i) => ({
                                        text: `${label}: ${data.datasets[0].data[i]}`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i,
                                        fontColor: textColor
                                    }));
                                }
                            }
                        },
                        tooltip: {
                            enabled: hasData,
                            backgroundColor: isDark ? '#0f172a' : '#ffffff',
                            titleColor: isDark ? '#f1f5f9' : '#0f172a',
                            bodyColor: isDark ? '#e2e8f0' : '#334155',
                            borderColor: isDark ? '#475569' : '#cbd5e1',
                            borderWidth: 2,
                            padding: 16,
                            titleFont: {
                                size: 14,
                                weight: '700'
                            },
                            bodyFont: {
                                size: 13,
                                weight: '600'
                            },
                            callbacks: {
                                label: function(context) {
                                    if (!hasData) return '';
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const value = context.parsed;
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${context.label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'emptyTasksMessage',
                    afterDraw: (chart) => {
                        if (!hasData) {
                            const ctx = chart.ctx;
                            const width = chart.width;
                            const height = chart.height;
                            const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                            
                            ctx.save();
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.font = 'bold 16px Plus Jakarta Sans, sans-serif';
                            ctx.fillStyle = textColor;
                            ctx.fillText('✨ Nenhuma tarefa ainda', width / 2, centerY - 12);
                            ctx.font = '13px Plus Jakarta Sans, sans-serif';
                            ctx.fillStyle = isDark ? '#64748b' : '#64748b';
                            ctx.fillText('Adicione tarefas para ver estatísticas', width / 2, centerY + 14);
                            ctx.restore();
                        }
                    }
                }]
            });
        } catch (error) {
            console.error('Erro ao criar gráfico de tarefas:', error);
        }
    }
}

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    const dateEl = document.getElementById('date-now');
    if (dateEl) {
        dateEl.innerText = Utils.formatDate(new Date(), 'long');
    }
    
    // Carregar preferência de tema
    loadThemePreference();
    
    // Carregar e exibir frase do dia
    displayDailyQuote();
    
    // Inicializar progresso do Pomodoro
    updatePomoProgress();
    
    // Aguardar Chart.js carregar antes de inicializar gráficos
    const initCharts = () => {
        if (typeof Chart !== 'undefined') {
            setTimeout(() => {
                updateDashboardCharts();
            }, 800);
        } else {
            setTimeout(initCharts, 200);
        }
    };
    initCharts();
    
    lucide.createIcons();
    
    // Registrar Service Worker (PWA)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('✅ PWA: Service Worker registrado com sucesso!', registration.scope);
            })
            .catch((error) => {
                console.error('❌ PWA: Erro ao registrar Service Worker:', error);
            });
    }
});
