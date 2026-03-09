const CONFIG = {
    API_KEY:            'AIzaSyAd4RDth4aGLqrxnPdeHK0ckT8I9r6QLjs',
    CALENDAR_ID:        'nathanael.raverdy@gmail.com',
    APPS_SCRIPT_URL:    'https://script.google.com/macros/s/AKfycbxNln1GhKA22Gz7gbp5vSp03cMOIgTm3tBXXpYeOrjiaaTRpPdfASrmUe-I3WxwIx4m/exec',
    DUREE_RDV:          60,
    DUREE_RDV_PREMIERE: 90,
    BUFFER_DOMICILE:    20,
    CRENEAUX: {
        matin:     ['08h00', '09h00', '10h00', '11h00'],
        apresMidi: ['12h00', '13h00', '14h00', '15h00', '16h00', '17h00']
    }
};

const JOURS_FERIES = [
    '2026-01-01', // Nouvel An
    '2026-01-02', // Berchtoldstag
    '2026-04-03', // Vendredi Saint
    '2026-04-06', // Lundi de Pâques
    '2026-05-01', // Fête du Travail
    '2026-05-14', // Ascension
    '2026-05-25', // Lundi de Pentecôte
    '2026-08-01', // Fête nationale
    '2026-12-25', // Noël
    '2026-12-26', // Saint-Étienne
];

let state = {
    currentYear:  new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    selectedDate: null,
    selectedSlot: null,
    busySlots:    [],
    fullDayOff:   [],
    type:         'cabinet'
};

const MOIS = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
];

function estJourFerie(date) {
    const iso = `${date.getFullYear()}-`
        + `${String(date.getMonth() + 1).padStart(2, '0')}-`
        + `${String(date.getDate()).padStart(2, '0')}`;
    return JOURS_FERIES.includes(iso);
}

function estWeekend(date) {
    const jour = date.getDay();
    return jour === 0 || jour === 6;
}

document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
    bindNavButtons();
    bindTypeRdv();
    bindEmailValidation();
    bindBtnReserver();

    document.querySelectorAll('input[name="type-consultation"]')
        .forEach(r => r.addEventListener('change', () => {
            if (state.selectedDate) renderSlots(state.busySlots);
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

        const isPast    = date < today;
        const isWeekend = estWeekend(date);
        const isFerie   = estJourFerie(date);
        const isFullOff = state.fullDayOff.some(
            off => off.toDateString() === date.toDateString()
        );

        if (isPast || isWeekend || isFerie || isFullOff) {
            btn.classList.add('calendar-day--past');
            btn.disabled = true;
        } else {
            if (state.selectedDate &&
                state.selectedDate.toDateString() === date.toDateString()) {
                btn.classList.add('calendar-day--selected');
            }
            btn.addEventListener('click', () => onDayClick(date, btn));
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
            if (state.selectedDate) renderSlots(state.busySlots);
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
    await loadSlots(date);
}

async function loadSlots(date) {
    if (CONFIG.API_KEY === 'VOTRE_CLE_API_ICI') {
        state.busySlots = [];
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

        state.busySlots = events
            .filter(ev => !!ev.start.dateTime)
            .map(ev => {
                const d = new Date(ev.start.dateTime);
                const h = String(d.getHours()).padStart(2, '0');
                const m = String(d.getMinutes()).padStart(2, '0');
                return `${h}h${m}`;
            });

        renderSlots(state.busySlots);

    } catch (err) {
        console.error('Erreur lecture calendrier :', err);
        renderSlots([]);
    }
}

function renderSlots(busySlots) {
    let slotsOccupes = [...busySlots];

    const premiere = document.querySelector('input[name="type-consultation"]:checked')?.value === 'premiere';
    const duree    = premiere ? CONFIG.DUREE_RDV_PREMIERE : CONFIG.DUREE_RDV;
    const tous     = [...CONFIG.CRENEAUX.matin, ...CONFIG.CRENEAUX.apresMidi];

    busySlots.forEach(creneau => {
        const [h, m]  = creneau.replace('h', ':').split(':').map(Number);
        const minutes = h * 60 + m;

        tous.forEach(c => {
            const [ch, cm] = c.replace('h', ':').split(':').map(Number);
            const cMin     = ch * 60 + cm;
            const bufferTotal = state.type === 'domicile'
                ? duree + CONFIG.BUFFER_DOMICILE
                : duree;

            if (cMin > minutes && cMin < minutes + bufferTotal
                && !slotsOccupes.includes(c)) {
                slotsOccupes.push(c);
            }
        });
    });

    renderSlotGroup('slots-matin',     CONFIG.CRENEAUX.matin,     slotsOccupes);
    renderSlotGroup('slots-apresMidi', CONFIG.CRENEAUX.apresMidi, slotsOccupes);
}

function renderSlotGroup(containerId, creneaux, slotsOccupes) {
    const container   = document.getElementById(containerId);
    const section     = container.closest('.slots-section');
    container.innerHTML = '';

    const disponibles = creneaux.filter(c => !slotsOccupes.includes(c));

    if (disponibles.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    disponibles.forEach(creneau => {
        const btn = document.createElement('button');
        btn.className   = 'slot-btn';
        btn.textContent = creneau;
        btn.addEventListener('click', () => selectSlot(btn, creneau));
        container.appendChild(btn);
    });
}

function selectSlot(btn, creneau) {
    document.querySelectorAll('.slot-btn--selected')
        .forEach(el => el.classList.remove('slot-btn--selected'));
    btn.classList.add('slot-btn--selected');
    state.selectedSlot = creneau;
}

function showPanel() { document.getElementById('rdv-panel').classList.add('visible'); }
function hidePanel() { document.getElementById('rdv-panel').classList.remove('visible'); }

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

        const payload = {
            nom, prenom, email, tel, adresse, info,
            date:      dateISO,
            heure:     state.selectedSlot,
            type:      state.type,
            typeNatal: typeNatal ? typeNatal.value : 'prenatal',
            premiere:  premiere,
            duree:     premiere ? CONFIG.DUREE_RDV_PREMIERE : CONFIG.DUREE_RDV
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

            // Bloque le créneau localement pour éviter une double réservation
            state.busySlots.push(state.selectedSlot);
            state.selectedSlot = null;
            renderSlots(state.busySlots);

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
