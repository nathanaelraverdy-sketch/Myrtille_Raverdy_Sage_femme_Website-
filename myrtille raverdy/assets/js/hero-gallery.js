// ============================================
// HERO — Carrousel photo incurvé (3D)
// Les photos sont disposées à l'intérieur d'un cylindre :
// petites au centre (loin), grandes sur les côtés (proches).
// Au clic sur une photo, on « zoome » dans le carrousel (comme un zoom
// d'objectif) : la photo remplit la scène, la précédente et la suivante
// restent visibles sur les côtés, en transparence, avec leur courbure.
// Deux chevrons et un compteur font alors tourner le carrousel zoomé.
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('hero-gallery');
    if (!gallery) return;

    const stage = gallery.querySelector('.hero-gallery__stage');
    const ring = gallery.querySelector('.hero-gallery__ring');
    const items = Array.from(gallery.querySelectorAll('.hero-gallery__item'));
    const count = items.length;
    if (!count) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const AUTOPLAY_MS = 3500;
    const MAX_ANGLE = 85 * Math.PI / 180;
    const ZOOM_IN_MS = 850;
    const ZOOM_OUT_MS = 700;
    const NAV_MS = 650;
    const SIDE_OPACITY = 0.35;   // opacité des photos voisines en mode zoomé
    const INTRO_SPREAD = 6;      // écartement des photos au début de l'apparition

    let pos = 0;          // position affichée (continue)
    let zoom = 0;         // 0 = vue normale, 1 = zoomé sur la photo
    let spread = 1;       // > 1 = photos écartées vers les côtés (début de l'apparition), 1 = carrousel en place
    let zoomed = false;   // état visé
    let radius = 1000;
    let depth = 650;
    let step = 0.22;      // écart angulaire entre deux photos (rad)
    let perspective = 1000;
    let cardW = 200;
    let cardH = 280;
    let baseStageH = 360; // hauteur normale de la scène
    let bleed = 0;        // ce que la scène déborde de son conteneur (espaces vides récupérés)
    let zoomStageH = 600; // hauteur de la scène en mode zoomé
    let zoomFactor = 3;   // agrandissement de la vue en mode zoomé
    let tween = null;
    let rafId = null;
    let paused = false;
    let autoplayId = null;
    let zoomScrollY = 0;

    const wrap = (v, n) => ((v % n) + n) % n;
    const pad = (n) => String(n).padStart(2, '0');
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    // --- Chevrons + compteur (visibles seulement en mode zoomé) ---
    const chevron = (dir) =>
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
        'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        (dir < 0 ? '<polyline points="15 6 9 12 15 18"></polyline>' : '<polyline points="9 6 15 12 9 18"></polyline>') +
        '</svg>';
    const nav = document.createElement('div');
    nav.className = 'hero-gallery__nav';
    nav.innerHTML =
        '<div class="hero-gallery__controls">' +
        `<button type="button" class="hero-gallery__btn hero-gallery__btn--prev" aria-label="Photo précédente">${chevron(-1)}</button>` +
        '<span class="hero-gallery__count" aria-live="polite"></span>' +
        `<button type="button" class="hero-gallery__btn hero-gallery__btn--next" aria-label="Photo suivante">${chevron(1)}</button>` +
        '</div>';
    stage.appendChild(nav);
    const counter = nav.querySelector('.hero-gallery__count');
    const btnPrev = nav.querySelector('.hero-gallery__btn--prev');
    const btnNext = nav.querySelector('.hero-gallery__btn--next');
    const setButtonsFocusable = (on) => {
        [btnPrev, btnNext].forEach((b) => { b.tabIndex = on ? 0 : -1; });
        nav.setAttribute('aria-hidden', on ? 'false' : 'true');
    };
    setButtonsFocusable(false);

    // Géométrie : la caméra est en retrait du centre du cylindre, avec un
    // angle moyen : légère distorsion sur les côtés, photos toujours lisibles.
    function measure() {
        const width = stage.clientWidth;
        const mobile = width < 700;

        // géométrie du cylindre (ne dépend que de la largeur)
        radius = width * (mobile ? 0.9 : 0.74);
        const camOffset = width * (mobile ? 0.16 : 0.22); // recul de la caméra derrière le centre
        perspective = width * (mobile ? 0.4 : 0.25);
        depth = perspective + camOffset;
        stage.style.perspective = `${perspective}px`;

        // Taille des photos d'après la hauteur de la scène (qui, elle, ne change
        // pas) : avec la perspective, les photos à l'écran sont plus petites ou
        // plus grandes que leur taille réelle. On calcule l'agrandissement de la
        // photo la plus grande encore visible à l'écran, et on dimensionne pour
        // qu'elle remplisse presque toute la hauteur de la scène.
        // (pas pendant le zoom : la scène est alors agrandie)
        if (!zoomed && zoom === 0) {
            gallery.style.flex = '';
            stage.style.height = '';
            baseStageH = stage.clientHeight;
            bleed = Math.max(0, baseStageH - gallery.clientHeight);
            let maxScale = 0;
            for (let a = 0; a < 1.5; a += 0.005) {
                const dist = radius * Math.cos(a) - camOffset; // distance à la caméra
                if (dist < perspective * 0.6) break;           // trop près : photo cachée
                const scale = perspective / dist;
                if (radius * Math.sin(a) * scale > width / 2) break; // centre hors de l'écran
                maxScale = Math.max(maxScale, scale);
            }
            const fill = (baseStageH * 0.96) / (maxScale || 1);
            const h = Math.max(92, Math.min(fill, width * (mobile ? 0.42 : 0.32), 440));
            gallery.style.setProperty('--card-h', `${h.toFixed(1)}px`);
            gallery.style.setProperty('--card-w', `${(h * (mobile ? 0.79 : 0.81)).toFixed(1)}px`);
        }

        cardW = items[0].offsetWidth || 200;
        cardH = items[0].offsetHeight || 280;
        step = (cardW * 1.06) / radius;

        // mode zoomé : la scène grandit et la photo centrale la remplit,
        // en laissant de la place pour le compteur et les chevrons
        const centerScale = perspective / (perspective + radius - depth); // taille à l'écran de la photo du fond
        zoomStageH = Math.min(window.innerHeight * 0.75, 720);
        const byHeight = (zoomStageH - 110) / (cardH * centerScale); // place pour « ‹ 04 / 17 › » dessous
        const byWidth = (width - (mobile ? 32 : 160)) / (cardW * centerScale);
        zoomFactor = Math.max(1.5, Math.min(byHeight, byWidth));
        stage.style.setProperty('--photo-w', `${cardW * centerScale * zoomFactor}px`);
    }

    function render() {
        const e = zoom;
        // zoom d'objectif : toute la vue s'agrandit autour du centre
        // (progression géométrique = grossissement régulier)
        const scale = Math.pow(zoomFactor, e);
        ring.style.transform = e > 0 ? `scale(${scale.toFixed(4)})` : '';
        // l'ombre des photos garde la même taille à l'écran
        ring.style.setProperty('--shadow-k', (1 / scale).toFixed(4));
        // la scène grandit en même temps (dans la même animation)
        const stageH = baseStageH + (Math.max(zoomStageH, baseStageH) - baseStageH) * e;
        stage.style.height = e > 0 ? `${stageH}px` : '';
        // le carrousel grandit et repousse le texte (au lieu de le recouvrir)
        gallery.style.flex = e > 0 ? `0 0 ${stageH - bleed}px` : '';

        items.forEach((item, i) => {
            // décalage par rapport au centre, ramené dans [-count/2, count/2)
            const offset = wrap(i - pos + count / 2, count) - count / 2;
            const angle = offset * step * spread;
            const z = -radius * Math.cos(angle) + depth;
            const near = perspective - z; // distance à la caméra
            const minNear = perspective * 0.55;
            const hidden = Math.abs(angle) > MAX_ANGLE || near < minNear;
            if (hidden) {
                item.style.visibility = 'hidden';
                return;
            }
            const x = radius * Math.sin(angle);
            // les photos qui passent tout près de la caméra s'effacent
            let opacity = Math.min(1, Math.max(0, (near - minNear) / (perspective * 0.15)));
            // apparition : les photos arrivent des côtés (elles sortent de la zone
            // cachée près de la caméra en fondu) ; la photo du centre apparaît en fondu
            if (spread > 1 && Math.abs(offset) < 0.5) opacity *= Math.max(0, (INTRO_SPREAD - spread) / (INTRO_SPREAD - 1));
            // en mode zoomé, les voisines restent visibles en transparence
            opacity *= 1 - e * (1 - SIDE_OPACITY) * Math.min(1, Math.abs(offset));
            item.style.visibility = opacity > 0.001 ? 'visible' : 'hidden';
            item.style.opacity = opacity.toFixed(3);
            item.style.transform =
                `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${(-angle).toFixed(4)}rad)`;
        });
    }

    // --- Animation pilotée par le temps (courbe douce, indépendante des fps) ---
    function frame(now) {
        rafId = null;
        if (!tween) return;
        if (tween.start === null) tween.start = now;
        const t = Math.min(1, (now - tween.start) / tween.duration);
        // la rotation peut finir avant le zoom (posLead < 1) :
        // la photo vient d'abord au centre, puis on zoome dessus
        const ease = tween.ease || easeInOut;
        const kPos = ease(Math.min(1, t / tween.posLead));
        const kZoom = ease(t);
        pos = tween.from.pos + (tween.to.pos - tween.from.pos) * kPos;
        zoom = tween.from.zoom + (tween.to.zoom - tween.from.zoom) * kZoom;
        spread = tween.from.spread + (tween.to.spread - tween.from.spread) * kZoom;
        render();
        if (t < 1) {
            rafId = requestAnimationFrame(frame);
        } else {
            const done = tween.onDone;
            tween = null;
            if (done) done();
        }
    }

    function animateTo(toPos, toZoom, duration, onDone, posLead = 1, ease = null) {
        if (reduceMotion) duration = 1;
        tween = {
            from: { pos, zoom, spread },
            to: { pos: toPos, zoom: toZoom, spread: 1 }, // toute animation finit carrousel déplié
            start: null, duration, onDone, posLead, ease,
        };
        if (!rafId) rafId = requestAnimationFrame(frame);
    }

    // destination actuelle (fin de l'animation en cours, sinon position actuelle)
    const targetPos = () => (tween ? tween.to.pos : Math.round(pos));

    function updateCounter(p) {
        counter.textContent = `${pad(wrap(p, count) + 1)} / ${pad(count)}`;
    }

    function goTo(value) {
        if (zoomed) updateCounter(value);
        animateTo(value, zoomed ? 1 : 0, zoomed ? NAV_MS : 900);
    }

    // --- Mode zoomé ---
    function zoomIn(toPos) {
        zoomed = true;
        stopAutoplay();
        zoomScrollY = window.scrollY;
        updateCounter(toPos);
        gallery.classList.add('is-zoomed');
        setButtonsFocusable(true);
        animateTo(toPos, 1, ZOOM_IN_MS, null, 0.55);
    }

    function zoomOut() {
        if (!zoomed) return;
        zoomed = false;
        gallery.classList.remove('is-zoomed');
        setButtonsFocusable(false);
        animateTo(Math.round(targetPos()), 0, ZOOM_OUT_MS);
        startAutoplay();
    }

    btnPrev.addEventListener('click', () => goTo(targetPos() - 1));
    btnNext.addEventListener('click', () => goTo(targetPos() + 1));

    // --- Autoplay ---
    function startAutoplay() {
        if (reduceMotion) return;
        stopAutoplay();
        autoplayId = setInterval(() => {
            if (!paused && !document.hidden && !zoomed && !dragging) goTo(targetPos() + 1);
        }, AUTOPLAY_MS);
    }
    function stopAutoplay() {
        if (autoplayId) clearInterval(autoplayId);
        autoplayId = null;
    }

    // --- Clavier ---
    gallery.tabIndex = 0;
    gallery.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            goTo(targetPos() + (e.key === 'ArrowLeft' ? -1 : 1));
            if (!zoomed) startAutoplay();
        }
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.hero-gallery__btn')) {
            e.preventDefault();
            zoomed ? zoomOut() : zoomIn(targetPos());
        }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') zoomOut(); });
    // clic en dehors du carrousel : on revient au carrousel entier
    document.addEventListener('pointerdown', (e) => {
        if (zoomed && !gallery.contains(e.target)) zoomOut();
    });
    // au scroll aussi
    window.addEventListener('scroll', () => {
        if (zoomed && Math.abs(window.scrollY - zoomScrollY) > 30) zoomOut();
    }, { passive: true });

    // --- Glisser (souris / doigt) et clics ---
    let dragStartX = 0;
    let dragStartPos = 0;
    let dragging = false;
    let moved = false;

    // décalage (en nombre de photos) entre la photo cliquée et le centre
    function offsetOf(el) {
        const index = items.indexOf(el);
        if (index === -1) return null;
        const base = Math.round(targetPos());
        return { base, offset: wrap(index - base + count / 2, count) - count / 2 };
    }

    stage.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.hero-gallery__nav')) return; // chevrons / compteur
        if (zoomed) {
            // clic sur une voisine : on passe à elle ; sur la photo centrale ou à côté : on revient
            const hit = offsetOf(document.elementFromPoint(e.clientX, e.clientY));
            if (hit && hit.offset !== 0) goTo(hit.base + hit.offset);
            else zoomOut();
            return;
        }
        dragging = true;
        moved = false;
        tween = null; // on prend la main sur l'animation en cours
        dragStartX = e.clientX;
        dragStartPos = pos;
        stage.setPointerCapture(e.pointerId);
        stage.classList.add('is-dragging');
    });

    stage.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - dragStartX;
        if (Math.abs(dx) > 5) moved = true;
        const pxPerItem = cardW * 0.9; // un écart d'une carte ≈ largeur de carte à l'écran
        pos = dragStartPos - dx / pxPerItem;
        render();
    });

    function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        stage.classList.remove('is-dragging');
        if (moved) {
            animateTo(Math.round(pos), 0, 450);
            startAutoplay();
            return;
        }
        // clic simple : amène la photo cliquée au centre et on zoome dessus
        const hit = offsetOf(document.elementFromPoint(e.clientX, e.clientY));
        if (hit) zoomIn(hit.base + hit.offset);
        else startAutoplay();
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    // pause au survol
    gallery.addEventListener('mouseenter', () => { paused = true; });
    gallery.addEventListener('mouseleave', () => { paused = false; });

    // --- Redimensionnement ---
    window.addEventListener('resize', () => { measure(); render(); });
    // la place du carrousel change aussi quand le texte se replie autrement
    // (police chargée, fenêtre redimensionnée…) : on suit la taille de la scène
    if ('ResizeObserver' in window) {
        let lastH = 0;
        let lastW = 0;
        new ResizeObserver(() => {
            if (zoomed || zoom > 0) return; // pendant le zoom, la scène change de taille exprès
            const w = stage.clientWidth;
            const h = stage.clientHeight;
            if (w === lastW && h === lastH) return;
            lastW = w;
            lastH = h;
            measure();
            render();
        }).observe(stage);
    }

    // --- Chargement puis apparition ---
    // Une roue de chargement tourne tant que les premières photos visibles ne
    // sont pas chargées (2,5 s au plus) ; ensuite les photos arrivent des deux
    // côtés, déjà courbées par la perspective, et glissent jusqu'à leur place.
    measure();
    spread = INTRO_SPREAD;
    pos = 0;
    render();

    const firstVisible = items.filter((_, i) => Math.abs(wrap(i + count / 2, count) - count / 2) <= 5);
    const loaded = Promise.all(firstVisible.map((img) => new Promise((resolve) => {
        if (img.complete) resolve();
        else {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        }
    })));
    const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    Promise.race([loaded, timeout]).then(() => {
        measure(); // les tailles peuvent avoir changé pendant le chargement (police…)
        gallery.classList.add('is-ready'); // la roue s'efface
        setTimeout(() => {
            animateTo(0, 0, 1900, startAutoplay, 1, easeOut);
        }, reduceMotion ? 0 : 250);
    });
});
