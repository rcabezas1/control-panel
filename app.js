const CLIENT_ID = '414155249788-4ijcpfmeaateovnvmio3fjdbcvc268ge.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let accessToken = null;

// Inicializar el cliente de token de Google de forma limpia
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
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&singleEvents=true&orderBy=startTime`;

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