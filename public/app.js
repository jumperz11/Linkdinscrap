/**
 * LinkScope Dashboard Client
 */

// State
const state = {
    isConnected: false,
    isRunning: false,
    sessionId: null,
    profilesViewed: 0,
    connectionsSent: 0,
    sessionStartTime: null,
    profiles: []
};

// DOM Elements
const elements = {
    connectionStatus: document.getElementById('connectionStatus'),
    loginBtn: document.getElementById('loginBtn'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    keywords: document.getElementById('keywords'),
    threshold: document.getElementById('threshold'),
    thresholdValue: document.getElementById('thresholdValue'),
    profilesViewed: document.getElementById('profilesViewed'),
    connectionsSent: document.getElementById('connectionsSent'),
    sessionTime: document.getElementById('sessionTime'),
    progressFill: document.getElementById('progressFill'),
    currentProfile: document.getElementById('currentProfile'),
    profileList: document.getElementById('profileList'),
    scheduleEnabled: document.getElementById('scheduleEnabled'),
    scheduleConfig: document.getElementById('scheduleConfig'),
    enableConnect: document.getElementById('enableConnect'),
    enableFollow: document.getElementById('enableFollow'),
    consoleOutput: document.getElementById('consoleOutput')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkConnectionStatus();
    loadConfig();
});

// Event Listeners
function setupEventListeners() {
    // Threshold slider
    elements.threshold.addEventListener('input', (e) => {
        elements.thresholdValue.textContent = e.target.value;
    });

    // Login button
    elements.loginBtn.addEventListener('click', handleLogin);

    // Start/Stop buttons
    elements.startBtn.addEventListener('click', handleStartSession);
    elements.stopBtn.addEventListener('click', handleStopSession);

    // Schedule toggle
    elements.scheduleEnabled.addEventListener('change', (e) => {
        elements.scheduleConfig.style.display = e.target.checked ? 'block' : 'none';
    });

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            filterProfiles(e.target.dataset.category);
        });
    });
}

// API Functions
async function api(endpoint, options = {}) {
    const response = await fetch(`/api${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    return response.json();
}

async function checkConnectionStatus() {
    try {
        const result = await api('/auth/status');
        updateConnectionStatus(result.connected);
    } catch (error) {
        console.error('Failed to check connection status:', error);
        updateConnectionStatus(false);
    }
}

async function loadConfig() {
    try {
        const config = await api('/config');
        if (config.keywords) elements.keywords.value = config.keywords;
        if (config.threshold) {
            elements.threshold.value = config.threshold;
            elements.thresholdValue.textContent = config.threshold;
        }
    } catch (error) {
        console.log('No saved config found');
    }
}

// Handlers
async function handleLogin() {
    elements.loginBtn.disabled = true;
    elements.loginBtn.innerHTML = `
    <span class="spinner"></span>
    Opening browser...
  `;

    try {
        await api('/auth/login', { method: 'POST' });
        // Poll for connection status
        pollConnectionStatus();
    } catch (error) {
        console.error('Login failed:', error);
        elements.loginBtn.disabled = false;
        elements.loginBtn.innerHTML = `Login to LinkedIn`;
    }
}

function pollConnectionStatus() {
    const interval = setInterval(async () => {
        const result = await api('/auth/status');
        if (result.connected) {
            clearInterval(interval);
            updateConnectionStatus(true);
            elements.loginBtn.disabled = false;
            elements.loginBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
        </svg>
        Connected
      `;
        }
    }, 2000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300000);
}

async function handleStartSession() {
    const keywords = elements.keywords.value.trim();
    if (!keywords) {
        alert('Please enter search keywords');
        return;
    }

    elements.startBtn.disabled = true;
    elements.stopBtn.disabled = false;
    state.isRunning = true;
    state.sessionStartTime = Date.now();

    try {
        const result = await api('/session/start', {
            method: 'POST',
            body: JSON.stringify({
                keywords,
                threshold: parseInt(elements.threshold.value),
                enableConnect: elements.enableConnect.checked,
                enableFollow: elements.enableFollow.checked
            })
        });

        state.sessionId = result.sessionId;
        pollSessionStatus();
        startSessionTimer();
    } catch (error) {
        console.error('Failed to start session:', error);
        elements.startBtn.disabled = false;
        elements.stopBtn.disabled = true;
        state.isRunning = false;
    }
}

async function handleStopSession() {
    try {
        await api('/session/stop', { method: 'POST' });
        state.isRunning = false;
        elements.startBtn.disabled = false;
        elements.stopBtn.disabled = true;
    } catch (error) {
        console.error('Failed to stop session:', error);
    }
}

// UI Updates
function updateConnectionStatus(connected) {
    state.isConnected = connected;
    const dot = elements.connectionStatus.querySelector('.status-dot');
    const text = elements.connectionStatus.querySelector('span:last-child');

    if (connected) {
        dot.className = 'status-dot connected';
        text.textContent = 'Connected';
        elements.startBtn.disabled = false;
    } else {
        dot.className = 'status-dot disconnected';
        text.textContent = 'Disconnected';
        elements.startBtn.disabled = true;
    }
}

function pollSessionStatus() {
    if (!state.isRunning) return;

    const interval = setInterval(async () => {
        if (!state.isRunning) {
            clearInterval(interval);
            return;
        }

        try {
            const status = await api('/session/status');
            updateSessionDisplay(status);

            if (status.completed) {
                state.isRunning = false;
                elements.startBtn.disabled = false;
                elements.stopBtn.disabled = true;
                clearInterval(interval);
            }
        } catch (error) {
            console.error('Failed to get session status:', error);
        }
    }, 2000);
}

function updateSessionDisplay(status) {
    elements.profilesViewed.textContent = status.profilesViewed || 0;
    elements.connectionsSent.textContent = status.connectionsSent || 0;
    elements.progressFill.style.width = `${(status.profilesViewed / 100) * 100}%`;

    if (status.currentProfile) {
        elements.currentProfile.innerHTML = `
      <div class="profile-name">${status.currentProfile.name}</div>
      <div class="profile-headline">${status.currentProfile.headline || ''}</div>
      <div class="profile-score">Score: ${status.currentProfile.score || '...'}</div>
    `;
    }

    if (status.profiles) {
        state.profiles = status.profiles;
        renderProfiles(status.profiles);
    }

    // Update console output
    if (status.consoleLogs && status.consoleLogs.length > 0) {
        const consoleHtml = status.consoleLogs
            .slice(-30) // Show last 30 lines
            .map(line => {
                let className = 'console-line';
                if (line.includes('⚠') || line.includes('warning')) className += ' warning';
                else if (line.includes('❌') || line.includes('error')) className += ' error';
                else if (line.includes('ℹ') || line.includes('info')) className += ' info';
                return `<p class="${className}">${escapeHtml(line)}</p>`;
            })
            .join('');
        elements.consoleOutput.innerHTML = consoleHtml;
        // Auto-scroll to bottom
        elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;
    }
}

// Helper to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function startSessionTimer() {
    const interval = setInterval(() => {
        if (!state.isRunning) {
            clearInterval(interval);
            return;
        }

        const elapsed = Math.floor((Date.now() - state.sessionStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        elements.sessionTime.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function renderProfiles(profiles) {
    if (!profiles || profiles.length === 0) {
        elements.profileList.innerHTML = '<p class="muted">No profiles yet. Start a session to begin.</p>';
        return;
    }

    elements.profileList.innerHTML = profiles.map(profile => `
    <div class="profile-item">
      <div class="profile-info">
        <div class="name">${profile.name}</div>
        <div class="headline">${profile.headline || ''}</div>
      </div>
      <div class="profile-score">
        <span class="score-badge ${getScoreClass(profile.score)}">${profile.score}</span>
        ${profile.action_taken ? `<span class="action-badge">${profile.action_taken}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function filterProfiles(category) {
    let filtered = state.profiles;

    if (category === 'high') {
        filtered = state.profiles.filter(p => p.score >= 75);
    } else if (category === 'medium') {
        filtered = state.profiles.filter(p => p.score >= 50 && p.score < 75);
    } else if (category === 'low') {
        filtered = state.profiles.filter(p => p.score < 50);
    }

    renderProfiles(filtered);
}

function getScoreClass(score) {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
}
