const CLIENT_ID = 'TU_CLIENT_ID_AQUI';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({ discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'] });
    gapiInited = true;
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: '' });
    gisInited = true;
}

function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error) throw resp;
        document.getElementById('login-container').style.display = 'none';
        loadUserCalendar();
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

async function loadUserCalendar() {
    const response = await gapi.client.calendar.events.list({
        'calendarId': 'primary', 'timeMin': (new Date()).toISOString(), 'singleEvents': true, 'orderBy': 'startTime'
    });
    const events = response.result.items.map(e => ({ title: e.summary, start: e.start.dateTime || e.start.date }));
    renderCalendar(events);
}

function renderCalendar(events) {
    const calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
        initialView: 'dayGridMonth', locale: 'es', events: events
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
    document.getElementById('clock-madrid').textContent = new Intl.DateTimeFormat('es-ES', { ...opt, timeZone: 'Europe/Madrid' }).format(new Date());
    document.getElementById('clock-bogota').textContent = new Intl.DateTimeFormat('es-ES', { ...opt, timeZone: 'America/Bogota' }).format(new Date());
}
setInterval(updateClocks, 1000);
updateClocks();

// --- PRONÓSTICO DEL CLIMA ---
async function fetchWeather() {
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.4168&longitude=-3.7038&current=temperature_2m&timezone=Europe%2FMadrid');
        const data = await res.json();
        document.getElementById('weather-info').innerHTML = `<span class="text-3xl font-mono">${Math.round(data.current.temperature_2m)}°C</span>`;
    } catch {
        document.getElementById('weather-info').textContent = 'Error al cargar';
    }
}
fetchWeather();