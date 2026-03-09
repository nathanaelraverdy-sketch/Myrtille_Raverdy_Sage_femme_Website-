const CONFIG = {
    API_KEY:            'AIzaSyAd4RDth4aGLqrxnPdeHK0ckT8I9r6QLjs',
    CALENDAR_ID:        'nathanael.raverdy@gmail.com',
    APPS_SCRIPT_URL:    'https://script.google.com/macros/s/AKfycbxNln1GhKA22Gz7gbp5vSp03cMOIgTm3tBXXpYeOrjiaaTRpPdfASrmUe-I3WxwIx4m/exec',
    DUREE_RDV:          60,
    DUREE_RDV_PREMIERE: 90,
    BUFFER_DOMICILE:    20,
    DEBUT_JOURNEE:      9 * 60,      
    FIN_JOURNEE:        18 * 60,    
    INTERVALLE:         30,          
};

const JOURS_FERIES = [
    '2026-01-01', '2026-01-02', '2026-04-03', '2026-04-06',
    '2026-05-01', '2026-05-14', '2026-05-25', '2026-08-01',
    '2026-12-25', '2026-12-26',
];

let state = {
    currentYear:  new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    selectedDate: null,
    selectedSlot: null,
    busyEvents:   [],
    fullDayOff:   [],
    joursComplets: [],   // jours sans aucun créneau dispo
    type:         'cabinet',
    rdvConfirme:  false
};

const MOIS = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
];

function toMinutes(heureStr) {
    const [h, m] = heureStr.replace('h', ':').split(':').map(Number);
    return h * 60 + m;
}

function toHeureStr(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

function estJourFerie(date) {
    const iso = `${date.getFullYear()}-`
        + `${String(date.getMonth() + 1).padStart(2, '0')}-`
        + `${String(date.getDate()).padStart(2, '0')}`;
    return JOURS_FERIES.includes(iso);
}

function estWeekend(date) {
    const j = date.getDay();
    return j === 0 || j === 6;
}

function estJourComplet(date) {
    return state.joursComplets.some(
        d => d.toDateString() === date.toDateString()
    );
}

// Génère tous les créneaux possibles entre DEBUT et FIN
function genererCreneaux(dureeMin) {
    const slots = [];
    for (let t = CONFIG.DEBUT_JOURNEE; t + dureeMin <= CONFIG.FIN_JOURNEE; t += CONFIG.INTERVALLE) {
        slots.push(t);
    }
    return slots;
}

// Vérifie si un créneau T (durée D, type newType) entre en conflit avec un événement E
function conflit(tMin, dureeMin, newType, event) {
    const buf = CONFIG.BUFFER_DOMICILE;

    const newStart = newType === 'domicile' ? tMin - buf : tMin;
    const newEnd   = newType === 'domicile' ? tMin + dureeMin + buf : tMin + dureeMin;

    const evStart  = event.domicile ? event.start - buf : event.start;
    const evEnd    = event.domicile ? event.end   + buf : event.end;

    return newStart < evEnd && newEnd > evStart;
}

// Calcule les créneaux disponibles pour un type de RDV donné
function creneauxDisponibles(busyEvents, dureeMin, type) {
    return genererCreneaux(dureeMin).filter(tMin =>
        !busyEvents.some(ev => conflit(tMin, dureeMin, type, ev))
    );
}

document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
    bindNavButtons();
    bindTypeRdv();
    bindEmailValidation();
    bindBtnReserver();

    document.querySelectorAll('input[name="type-consultation"]')
        .forEach(r => r.addEventListener('change', () => {
            if (state.selectedDate) renderSlots(state.busyEvents);
        }));
});

function renderCalendar() {
    const grid  = document.getElementById('calendar-grid');
    const label = document.getElementById('calendar-month-label');
    const year  = state.currentYear;
    const month = state.currentMonth;

    label.textContent = `${MOIS[month]} ${year}`;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today       = new Date();
    today.setHours(0, 0, 0, 0);

    let firstDow = new Date(year, month, 1).getDay();
    firstDow = (firstDow === 0) ? 6 : firstDow - 1;

    grid.innerHTML = '';

    for (let i = 0; i < firstDow; i++) {
        grid.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const btn  = document.createElement('button');
        btn.className   = 'calendar-day';
        btn.textContent = d;

        const bloque = date < today
            || estWeekend(date)
            || estJourFerie(date)
            || state.fullDayOff.some(off => off.toDateString() === date.toDateString())
            || estJourComplet(date);

        if (bloque) {
            btn.classList.add('calendar-day--past');
            btn.disabled = true;
        } else {
            if (state.selectedDate &&
                state.selectedDate.toDateString() === date.toDateString()) {
                btn.classList.add('calendar-day--selected');
            }
            btn.addEventListener('click', () => {
                if (!state.rdvConfirme) onDayClick(date, btn);
            });
        }

        grid.appendChild(btn);
    }
}

function bindNavButtons() {
    document.getElementById('prev-month').addEventListener('click', () => {
        state.currentMonth--;
        if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
        state.selectedDate = null;
        renderCalendar();
        hidePanel();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        state.currentMonth++;
        if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
        state.selectedDate = null;
        renderCalendar();
        hidePanel();
    });
}

function bindTypeRdv() {
    document.querySelectorAll('input[name="type-rdv"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.type = e.target.value;
            document.getElementById('champ-adresse').style.display =
                state.type === 'domicile' ? 'flex' : 'none';
            if (state.selectedDate) renderSlots(state.busyEvents);
        });
    });
}

function bindEmailValidation() {
    const emailInput = document.getElementById('input-email');
    const errorMsg   = document.getElementById('email-error');

    emailInput.addEventListener('blur', () => {
        const val   = emailInput.value.trim();
        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        if (val && !valid) errorMsg.classList.add('visible');
        else errorMsg.classList.remove('visible');
    });

    emailInput.addEventListener('input', () => {
        errorMsg.classList.remove('visible');
    });
}

async function onDayClick(date, btn) {
    document.querySelectorAll('.calendar-day--selected')
        .forEach(el => el.classList.remove('calendar-day--selected'));
    btn.classList.add('calendar-day--selected');

    state.selectedDate = date;
    state.selectedSlot = null;

    const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    document.getElementById('panel-date').textContent = `Disponibilité pour le ${dateStr}`;

    showPanel();
    await loadSlots(date, btn);
}

async function loadSlots(date, btn) {
    if (CONFIG.API_KEY === 'VOTRE_CLE_API_ICI') {
        state.busyEvents = [];
        renderSlots([]);
        return;
    }

    try {
        const start = new Date(date); start.setHours(0, 0, 0, 0);
        const end   = new Date(date); end.setHours(23, 59, 59, 999);

        const url = `https://www.googleapis.com/calendar/v3/calendars/`
            + `${encodeURIComponent(CONFIG.CALENDAR_ID)}/events`
            + `?key=${CONFIG.API_KEY}`
            + `&timeMin=${start.toISOString()}`
            + `&timeMax=${end.toISOString()}`
            + `&singleEvents=true`;

        const res    = await fetch(url);
        const data   = await res.json();
        const events = data.items || [];

        const isFullDayOff = events.some(ev => !!ev.start.date && !ev.start.dateTime);
        if (isFullDayOff) {
            state.fullDayOff.push(new Date(date));
            renderCalendar();
            hidePanel();
            return;
        }

        state.busyEvents = events
            .filter(ev => !!ev.start.dateTime)
            .map(ev => {
                const dStart   = new Date(ev.start.dateTime);
                const dEnd     = new Date(ev.end.dateTime);
                const startMin = dStart.getHours() * 60 + dStart.getMinutes();
                const endMin   = dEnd.getHours()   * 60 + dEnd.getMinutes();
                const isDomicile = (ev.summary || '').toLowerCase().includes('domicile');
                return { start: startMin, end: endMin, domicile: isDomicile };
            });

        // Vérifie si le jour est totalement complet pour TOUS les types de RDV
        const dureeStd  = CONFIG.DUREE_RDV;
        const dureePrem = CONFIG.DUREE_RDV_PREMIERE;
        const aucunDispo =
            creneauxDisponibles(state.busyEvents, dureeStd,  'cabinet').length === 0 &&
            creneauxDisponibles(state.busyEvents, dureeStd,  'domicile').length === 0 &&
            creneauxDisponibles(state.busyEvents, dureePrem, 'cabinet').length === 0 &&
            creneauxDisponibles(state.busyEvents, dureePrem, 'domicile').length === 0;

        if (aucunDispo) {
            state.joursComplets.push(new Date(date));
            if (btn) btn.classList.add('calendar-day--past');
            renderCalendar();
            hidePanel();
            return;
        }

        renderSlots(state.busyEvents);

    } catch (err) {
        console.error('Erreur lecture calendrier :', err);
        renderSlots([]);
    }
}

function renderSlots(busyEvents) {
    const premiere = document.querySelector('input[name="type-consultation"]:checked')?.value === 'premiere';
    const duree    = premiere ? CONFIG.DUREE_RDV_PREMIERE : CONFIG.DUREE_RDV;

    const disponibles = creneauxDisponibles(busyEvents, duree, state.type);

    // Sépare matin (< 12h00) et après-midi
    const matin     = disponibles.filter(t => t < 12 * 60);
    const apresMidi = disponibles.filter(t => t >= 12 * 60);

    renderSlotGroup('slots-matin',     matin);
    renderSlotGroup('slots-apresMidi', apresMidi);
}

function renderSlotGroup(containerId, slots) {
    const container = document.getElementById(containerId);
    const section   = container.closest('.slots-section');
    container.innerHTML = '';

    if (slots.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    slots.forEach(tMin => {
        const heureStr = toHeureStr(tMin);
        const btn = document.createElement('button');
        btn.className   = 'slot-btn';
        btn.textContent = heureStr;
        btn.addEventListener('click', () => selectSlot(btn, heureStr));
        container.appendChild(btn);
    });
}

function selectSlot(btn, heureStr) {
    document.querySelectorAll('.slot-btn--selected')
        .forEach(el => el.classList.remove('slot-btn--selected'));
    btn.classList.add('slot-btn--selected');
    state.selectedSlot = heureStr;
}

function showPanel() { document.getElementById('rdv-panel').classList.add('visible'); }
function hidePanel() { document.getElementById('rdv-panel').classList.remove('visible'); }

function bloquerApresReservation() {
    document.querySelectorAll('.slots-section').forEach(s => s.style.display = 'none');
    document.querySelector('.rdv-form').style.display      = 'none';
    document.querySelector('.radio-group').style.display   = 'none';
    document.getElementById('champ-adresse').style.display = 'none';
    state.rdvConfirme = true;
}

function afficherConfirmation(payload) {
    const dateStr  = state.selectedDate.toLocaleDateString('fr-FR',
        { day: 'numeric', month: 'long', year: 'numeric' });
    const lieuStr  = payload.type === 'domicile'
        ? `à domicile (${payload.adresse})` : 'en cabinet';
    const dureeStr = payload.premiere ? '1h30 (première consultation)' : '1h';

    document.getElementById('confirmation-text').innerHTML =
        `✅ Votre rendez-vous du <strong>${dateStr} à ${payload.heure}</strong>
         <strong>${lieuStr}</strong> a bien été enregistré.<br>
         Durée : <strong>${dureeStr}</strong><br><br>
         Un email de confirmation a été envoyé à <strong>${payload.email}</strong>.`;

    document.getElementById('rdv-confirmation').style.display = 'block';
    document.getElementById('rdv-confirmation')
        .scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function bindBtnReserver() {
    document.getElementById('btn-reserver').addEventListener('click', async () => {

        const nom      = document.getElementById('input-nom').value.trim();
        const prenom   = document.getElementById('input-prenom').value.trim();
        const email    = document.getElementById('input-email').value.trim();
        const tel      = document.getElementById('input-tel').value.trim();
        const adresse  = document.getElementById('input-adresse').value.trim();
        const info     = document.getElementById('input-info').value.trim();
        const typeNatal= document.querySelector('input[name="type-natal"]:checked');
        const premiere = document.querySelector('input[name="type-consultation"]:checked')?.value === 'premiere';
        const errorMsg = document.getElementById('email-error');

        if (!state.selectedDate || !state.selectedSlot) {
            alert('Veuillez sélectionner une date et un créneau.');
            return;
        }
        if (!nom || !prenom) {
            alert('Veuillez remplir votre nom et votre prénom.');
            return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errorMsg.classList.add('visible');
            document.getElementById('input-email').focus();
            return;
        }
        if (state.type === 'domicile' && !adresse) {
            alert('Veuillez indiquer votre adresse pour un RDV à domicile.');
            return;
        }

        const dateISO = `${state.selectedDate.getFullYear()}-`
            + `${String(state.selectedDate.getMonth() + 1).padStart(2, '0')}-`
            + `${String(state.selectedDate.getDate()).padStart(2, '0')}`;

        const duree = premiere ? CONFIG.DUREE_RDV_PREMIERE : CONFIG.DUREE_RDV;

        const payload = {
            nom, prenom, email, tel, adresse, info,
            date:      dateISO,
            heure:     state.selectedSlot,
            type:      state.type,
            typeNatal: typeNatal ? typeNatal.value : 'prenatal',
            premiere:  premiere,
            duree:     duree
        };

        const btnReserver = document.getElementById('btn-reserver');
        btnReserver.disabled    = true;
        btnReserver.textContent = 'Envoi en cours…';

        try {
            await fetch(CONFIG.APPS_SCRIPT_URL, {
                method:  'POST',
                mode:    'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body:    JSON.stringify(payload)
            });

            // Ajoute localement pour bloquer immédiatement le créneau
            const tMin = toMinutes(state.selectedSlot);
            state.busyEvents.push({
                start:    tMin,
                end:      tMin + duree,
                domicile: state.type === 'domicile'
            });

            bloquerApresReservation();
            afficherConfirmation(payload);
            btnReserver.textContent = 'Réservé ✓';

        } catch (err) {
            console.error('Erreur réservation :', err);
            alert('Une erreur est survenue. Veuillez réessayer ou nous contacter par téléphone.');
            btnReserver.disabled    = false;
            btnReserver.textContent = 'Réserver';
        }
    });
}
