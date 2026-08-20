const CLIENT_ID = '414155249788-4ijcpfmeaateovnvmio3fjdbcvc268ge.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
        });
        gapiInited = true;
    } catch (error) {
        console.error("Error al inicializar GAPI Client:", error);
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: ''
    });
    gisInited = true;
}

function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error) {
            console.error("Error de autenticación:", resp);
            return;
        }
        document.getElementById('login-container').style.display = 'none';
        loadUserCalendar();
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

async function loadUserCalendar() {
    try {
        await gapi.client.load('calendar', 'v3');

        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': (new Date()).toISOString(),
            'singleEvents': true,
            'orderBy': 'startTime'
        });

        const items = response.result.items || [];
        const events = items.map(e => ({
            title: e.summary || 'Sin título',
            start: e.start.dateTime || e.start.date,
            end: e.end ? (e.end.dateTime || e.end.date) : null
        }));

        renderCalendar(events);
    } catch (err) {
        console.error("Error detallado al cargar eventos del calendario:", err);
        document.getElementById('calendar').innerHTML = `
            <div class="text-center py-8 text-rose-400 text-sm">
                No se pudieron cargar los eventos. Revisa la consola del navegador (F12).
            </div>
        `;
    }
}

function renderCalendar(events) {
    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        events: events
    });
    calendar.render();
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