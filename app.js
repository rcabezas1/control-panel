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

window.onload = function () {
    if (typeof google !== 'undefined' && google.accounts) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (resp) => {
                if (resp.error) return;
                accessToken = resp.access_token;
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('calendar-section').classList.remove('hidden');
                loadUserCalendarsList();
                if (refreshInterval) clearInterval(refreshInterval);
                refreshInterval = setInterval(refreshCurrentCalendar, 3600000);
            },
        });
    }
};

function handleAuthClick() { tokenClient.requestAccessToken({ prompt: 'consent' }); }

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(requestWakeLock);
    } else { document.exitFullscreen(); }
}

async function loadUserCalendarsList() {
    if (!accessToken) return;
    try {
        const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const data = await res.json();
        const selectEl = document.getElementById('calendar-select');
        selectEl.innerHTML = '';
        data.items.forEach((cal, i) => {
            const opt = document.createElement('option');
            opt.value = cal.id; opt.textContent = cal.summary;
            if (cal.primary || i === 0) opt.selected = true;
            selectEl.appendChild(opt);
        });
        loadUserCalendar(selectEl.value);
    } catch (err) { console.error(err); }
}

function onCalendarChange() { loadUserCalendar(document.getElementById('calendar-select').value); }
function refreshCurrentCalendar() { loadUserCalendar(document.getElementById('calendar-select').value); }

async function loadUserCalendar(calendarId) {
    if (!accessToken) return;
    try {
        const timeMin = new Date().toISOString();
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=9`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();
        renderEventsGrid(data.items || []);
    } catch (err) { console.error(err); }
}

function renderEventsGrid(items) {
    const container = document.getElementById('events-container');
    container.innerHTML = items.length === 0 ? '<p class="text-lg text-slate-500 col-span-full">No hay eventos.</p>' :
        items.map(e => `
        <div class="bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 flex flex-col justify-between gap-3 shadow-xl">
            <span class="font-bold text-white text-lg">${e.summary || 'Sin título'}</span>
            <span class="text-sm text-slate-400 font-mono bg-black px-3 py-2 rounded-lg border border-slate-800 self-start">
                ${new Date(e.start.dateTime || e.start.date).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    `).join('');
}

function updateClocks() {
    // Solo hora y minuto
    const opt = { hour: '2-digit', minute: '2-digit', hour12: false };
    document.getElementById('clock-madrid').textContent = new Intl.DateTimeFormat('es-ES', { ...opt, timeZone: 'Europe/Madrid' }).format(new Date());
    document.getElementById('clock-bogota').textContent = new Intl.DateTimeFormat('es-ES', { ...opt, timeZone: 'America/Bogota' }).format(new Date());
}
setInterval(updateClocks, 60000); // Se actualiza cada minuto en lugar de cada segundo
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
fetchWeather();