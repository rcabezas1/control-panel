const CLIENT_ID = '414155249788-4ijcpfmeaateovnvmio3fjdbcvc268ge.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let accessToken = null;
let refreshInterval = null;
let wakeLock = null;

async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) { console.error(`${err.name}, ${err.message}`); }
}

document.addEventListener('visibilitychange', () => {
    if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock();
});

// Escuchar cambios de pantalla completa (por ejemplo, si se presiona ESC o se sale mediante gestos móviles)
document.addEventListener('fullscreenchange', () => {
    const isFullscreen = !!document.fullscreenElement;
    // En pantalla completa se oculta el botón de entrar y se muestra la X para salir
    document.getElementById('fullscreen-btn').classList.toggle('hidden', isFullscreen);
    document.getElementById('exit-fullscreen-btn').classList.toggle('hidden', !isFullscreen);
});

// --- Persistencia de la autorización ---
// El modelo de token de Google Identity Services no entrega refresh token: se guarda el
// access token con su caducidad y se renueva antes de que expire sin volver a pedir consentimiento.
const AUTH_STORAGE_KEY = 'gcal_auth';
const CALENDAR_STORAGE_KEY = 'gcal_calendar_id';
const TOKEN_RENEW_MARGIN_MS = 5 * 60 * 1000;
let renewTimeout = null;

function readStorage(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* almacenamiento no disponible */ }
}

function removeStorage(key) {
    try { localStorage.removeItem(key); } catch { /* almacenamiento no disponible */ }
}

function hasStoredGrant() { return readStorage(AUTH_STORAGE_KEY) !== null; }

function isTokenValid(auth) {
    return !!(auth && auth.token && auth.expiresAt - Date.now() > TOKEN_RENEW_MARGIN_MS);
}

function showLogin(label) {
    const container = document.getElementById('login-container');
    container.querySelector('button').textContent = label;
    container.style.display = '';
}

function startSession(token, expiresAt) {
    accessToken = token;
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('calendar-section').classList.remove('hidden');
    scheduleTokenRenewal(expiresAt);
    loadUserCalendarsList();
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(refreshCurrentCalendar, 3600000);
}

function scheduleTokenRenewal(expiresAt) {
    if (renewTimeout) clearTimeout(renewTimeout);
    const delay = Math.max(expiresAt - Date.now() - TOKEN_RENEW_MARGIN_MS, 0);
    // prompt '' reutiliza el consentimiento ya otorgado: sin pantalla de permisos
    renewTimeout = setTimeout(() => tokenClient.requestAccessToken({ prompt: '' }), delay);
}

function handleExpiredToken() {
    accessToken = null;
    if (renewTimeout) clearTimeout(renewTimeout);
    // Se conserva el registro de autorización para reconectar con un solo clic
    writeStorage(AUTH_STORAGE_KEY, { token: null, expiresAt: 0 });
    showLogin('Reconectar Google Calendar');
}

window.onload = function () {
    if (typeof google !== 'undefined' && google.accounts) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (resp) => {
                if (resp.error) { handleExpiredToken(); return; }
                const expiresAt = Date.now() + Number(resp.expires_in) * 1000;
                writeStorage(AUTH_STORAGE_KEY, { token: resp.access_token, expiresAt });
                startSession(resp.access_token, expiresAt);
            },
            // Popup bloqueado o cerrado (p. ej. renovación sin interacción del usuario)
            error_callback: () => handleExpiredToken(),
        });

        const stored = readStorage(AUTH_STORAGE_KEY);
        if (isTokenValid(stored)) {
            startSession(stored.token, stored.expiresAt);
        } else if (stored) {
            showLogin('Reconectar Google Calendar');
        }
    }
};

function handleAuthClick() {
    tokenClient.requestAccessToken({ prompt: hasStoredGrant() ? '' : 'consent' });
}

function handleDisconnectClick() {
    if (accessToken) google.accounts.oauth2.revoke(accessToken, () => {});
    accessToken = null;
    if (renewTimeout) clearTimeout(renewTimeout);
    if (refreshInterval) clearInterval(refreshInterval);
    removeStorage(AUTH_STORAGE_KEY);
    removeStorage(CALENDAR_STORAGE_KEY);
    document.getElementById('calendar-section').classList.add('hidden');
    showLogin('Conectar mi Google Calendar');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(requestWakeLock);
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

async function loadUserCalendarsList() {
    if (!accessToken) return;
    try {
        const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (res.status === 401) { handleExpiredToken(); return; }
        const data = await res.json();
        const selectEl = document.getElementById('calendar-select');
        selectEl.innerHTML = '';

        const keywords = ['compartido', 'compartir', 'shared', 'share'];
        const savedCalendarId = readStorage(CALENDAR_STORAGE_KEY);
        let defaultCalendarId = data.items.some(cal => cal.id === savedCalendarId) ? savedCalendarId : null;

        data.items.forEach((cal) => {
            const summaryLower = (cal.summary || '').toLowerCase();
            const matchesKeyword = keywords.some(keyword => summaryLower.includes(keyword));
            if (matchesKeyword && !defaultCalendarId) {
                defaultCalendarId = cal.id;
            }
        });

        data.items.forEach((cal, i) => {
            const opt = document.createElement('option');
            opt.value = cal.id;
            opt.textContent = cal.summary;

            if (defaultCalendarId) {
                if (cal.id === defaultCalendarId) opt.selected = true;
            } else {
                if (cal.primary || i === 0) opt.selected = true;
            }

            selectEl.appendChild(opt);
        });

        loadUserCalendar(selectEl.value);
    } catch (err) { console.error(err); }
}

function onCalendarChange() {
    const calendarId = document.getElementById('calendar-select').value;
    writeStorage(CALENDAR_STORAGE_KEY, calendarId);
    loadUserCalendar(calendarId);
}
function refreshCurrentCalendar() { loadUserCalendar(document.getElementById('calendar-select').value); }

async function loadUserCalendar(calendarId) {
    if (!accessToken) return;
    try {
        const timeMin = new Date().toISOString();
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=9`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (res.status === 401) { handleExpiredToken(); return; }
        const data = await res.json();
        renderEventsGrid(data.items || []);
    } catch (err) { console.error(err); }
}

function renderEventsGrid(items) {
    const container = document.getElementById('events-container');
    container.innerHTML = items.length === 0 ? '<p class="text-lg text-slate-500 col-span-full">No hay eventos.</p>' :
        items.map(e => {
            const startRaw = e.start.dateTime || e.start.date;
            const endRaw = e.end.dateTime || e.end.date;

            const start = new Date(startRaw);
            const end = new Date(endRaw);

            const startStr = start.toLocaleString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const endStr = end.toLocaleString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            const timeDisplay = (startRaw !== endRaw) ? `${startStr} - ${endStr}` : startStr;

            return `
            <div class="bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 flex flex-col justify-between gap-3 shadow-xl">
                <span class="font-bold text-white text-lg leading-tight">${e.summary || 'Sin título'}</span>
                <span class="text-xs sm:text-sm text-slate-400 font-mono bg-black px-3 py-2 rounded-lg border border-slate-800 self-start">
                    ${timeDisplay}
                </span>
            </div>
        `;
        }).join('');
}

function updateClocks() {
    const opt = { hour: '2-digit', minute: '2-digit', hour12: false };
    document.getElementById('clock-madrid').textContent = new Intl.DateTimeFormat('es-ES', { ...opt, timeZone: 'Europe/Madrid' }).format(new Date());
    document.getElementById('clock-bogota').textContent = new Intl.DateTimeFormat('es-ES', { ...opt, timeZone: 'America/Bogota' }).format(new Date());
}
setInterval(updateClocks, 60000);
updateClocks();

async function fetchWeather() {
    const coords = { madrid: '40.4168,-3.7038', bogota: '4.6097,-74.0817' };
    ['madrid', 'bogota'].forEach(async (city) => {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords[city].split(',')[0]}&longitude=${coords[city].split(',')[1]}&current=temperature_2m`);
            const data = await res.json();
            document.getElementById(`weather-${city}`).textContent = `${Math.round(data.current.temperature_2m)}°C`;
        } catch { document.getElementById(`weather-${city}`).textContent = 'Error'; }
    });
}
setInterval(fetchWeather, 15 * 60 * 1000);
fetchWeather();