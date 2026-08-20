const CLIENT_ID = '414155249788-4ijcpfmeaateovnvmio3fjdbcvc268ge.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let accessToken = null;

window.onload = function () {
    if (typeof google !== 'undefined' && google.accounts) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (resp) => {
                if (resp.error) {
                    console.error("Error de autenticación:", resp);
                    return;
                }
                accessToken = resp.access_token;
                document.getElementById('login-container').style.display = 'none';
                loadUserCalendar();
            },
        });
    }
};

function handleAuthClick() {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        console.error("Google Identity Services no está listo todavía.");
    }
}

async function loadUserCalendar() {
    if (!accessToken) return;

    try {
        const timeMin = new Date().toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=10`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al obtener los eventos de Google Calendar');
        }

        const data = await response.json();
        const items = data.items || [];

        renderEventsList(items);
    } catch (err) {
        console.error("Error detallado al cargar eventos:", err);
        document.getElementById('events-container').innerHTML = `
            <div class="text-center py-4 text-rose-400 text-sm">
                No se pudieron cargar los eventos. Revisa la consola del navegador (F12).
            </div>
        `;
    }
}

function renderEventsList(items) {
    const container = document.getElementById('events-container');

    if (items.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400">No hay eventos próximos.</p>`;
        return;
    }

    container.innerHTML = items.map(e => {
        const startRaw = e.start.dateTime || e.start.date;
        const startDate = new Date(startRaw);
        const dateFormatted = isNaN(startDate) ? startRaw : startDate.toLocaleString('es-ES', {
            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return `
            <div class="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span class="font-medium text-slate-200 text-sm sm:text-base">${e.summary || 'Sin título'}</span>
                <span class="text-xs text-slate-400 font-mono bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">${dateFormatted}</span>
            </div>
        `;
    }).join('');
}

// --- CONTROL DE PANTALLA COMPLETA ---
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.error(`Error al intentar activar pantalla completa: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// --- RELOJES MUNDIALES ---
function updateClocks() {
    const opt = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const madridEl = document.getElementById('clock-madrid');
    const bogotaEl = document.getElementById('clock-bogota');

    if (madridEl) madridEl.textContent = new Intl.DateTimeFormat('es-ES', { ...opt, timeZone: 'Europe/Madrid' }).format(new Date());
    if (bogotaEl) bogotaEl.textContent = new Intl.DateTimeFormat('es-ES', { ...opt, timeZone: 'America/Bogota' }).format(new Date());
}
setInterval(updateClocks, 1000);
updateClocks();

// --- PRONÓSTICO DEL CLIMA ---
async function fetchWeather() {
    const weatherEl = document.getElementById('weather-info');
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.4168&longitude=-3.7038&current=temperature_2m&timezone=Europe%2FMadrid');
        const data = await res.json();
        if (weatherEl) {
            weatherEl.innerHTML = `<span class="text-3xl font-mono">${Math.round(data.current.temperature_2m)}°C</span>`;
        }
    } catch {
        if (weatherEl) weatherEl.textContent = 'Error al cargar';
    }
}
fetchWeather();