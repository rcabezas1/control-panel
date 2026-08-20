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
                document.getElementById('calendar-section').classList.remove('hidden');
                loadUserCalendarsList();
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

// 1. Cargar la lista de todos los calendarios del usuario en el desplegable
async function loadUserCalendarsList() {
    if (!accessToken) return;

    try {
        const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) throw new Error('Error al obtener la lista de calendarios');

        const data = await response.json();
        const calendars = data.items || [];

        const selectEl = document.getElementById('calendar-select');
        selectEl.innerHTML = '';

        if (calendars.length === 0) {
            selectEl.innerHTML = `<option value="">No se encontraron calendarios</option>`;
            return;
        }

        calendars.forEach((cal, index) => {
            const option = document.createElement('option');
            option.value = cal.id;
            option.textContent = cal.summary;
            if (cal.primary || index === 0) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        });

        loadUserCalendar(selectEl.value);

    } catch (err) {
        console.error("Error detallado al cargar calendarios:", err);
        document.getElementById('events-container').innerHTML = `
            <div class="text-center py-4 text-rose-400 text-sm">
                No se pudo cargar la lista de calendarios.
            </div>
        `;
    }
}

function onCalendarChange() {
    const selectEl = document.getElementById('calendar-select');
    const selectedCalendarId = selectEl.value;
    if (selectedCalendarId) {
        loadUserCalendar(selectedCalendarId);
    }
}

async function loadUserCalendar(calendarId) {
    if (!accessToken) return;

    try {
        const timeMin = new Date().toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=10`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) throw new Error('Error al obtener los eventos');

        const data = await response.json();
        renderEventsList(data.items || []);
    } catch (err) {
        console.error("Error detallado al cargar eventos:", err);
        document.getElementById('events-container').innerHTML = `
            <div class="text-center py-4 text-rose-400 text-sm">
                No se pudieron cargar los eventos de este calendario.
            </div>
        `;
    }
}

function renderEventsList(items) {
    const container = document.getElementById('events-container');

    if (items.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400 py-2">No hay eventos próximos en este calendario.</p>`;
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

// --- PRONÓSTICO DEL CLIMA (Madrid y Bogotá) ---
async function fetchWeather() {
    // Clima Madrid (Lat: 40.4168, Lon: -3.7038)
    const weatherMadridEl = document.getElementById('weather-madrid');
    try {
        const resMadrid = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.4168&longitude=-3.7038&current=temperature_2m&timezone=Europe%2FMadrid');
        const dataMadrid = await resMadrid.json();
        if (weatherMadridEl) {
            weatherMadridEl.textContent = `${Math.round(dataMadrid.current.temperature_2m)}°C`;
        }
    } catch {
        if (weatherMadridEl) weatherMadridEl.textContent = 'Error';
    }

    // Clima Bogotá (Lat: 4.6097, Lon: -74.0817)
    const weatherBogotaEl = document.getElementById('weather-bogota');
    try {
        const resBogota = await fetch('https://api.open-meteo.com/v1/forecast?latitude=4.6097&longitude=-74.0817&current=temperature_2m&timezone=America%2FBogota');
        const dataBogota = await resBogota.json();
        if (weatherBogotaEl) {
            weatherBogotaEl.textContent = `${Math.round(dataBogota.current.temperature_2m)}°C`;
        }
    } catch {
        if (weatherBogotaEl) weatherBogotaEl.textContent = 'Error';
    }
}
fetchWeather();