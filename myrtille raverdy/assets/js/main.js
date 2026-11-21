/* ============================================
   MAIN.JS — Scripts globaux
   Myrtille Raverdy — Sage-femme à Lausanne
   ============================================ */


// (Le colibri de la navbar est animé dans assets/js/colibri.js.)


document.addEventListener('DOMContentLoaded', () => {

    const revealElements = document.querySelectorAll('.reveal');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // on ne re-anime pas
            }
        });
    }, {
        threshold: 0.15,       // déclenche quand 15% de l'élément est visible
        rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => observer.observe(el));

});


// ============================================
// Bouton "Prendre rendez-vous" : passe du hero à la navbar
// Quand le bouton du hero arrive sous la navbar, il s'efface,
// puis le bouton de la navbar apparaît (et inversement en remontant).
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const heroCta = document.getElementById('hero-cta');
    const navCta = document.getElementById('nav-cta');
    const navbar = document.querySelector('.navbar');
    if (!heroCta || !navCta || !navbar) return;

    const MARGIN = 24; // le bouton s'efface un peu avant de toucher la navbar
    let docked = null;
    let ticking = false;

    function update() {
        ticking = false;
        const navBottom = navbar.getBoundingClientRect().bottom;
        const heroTop = heroCta.getBoundingClientRect().top;
        const shouldDock = heroTop < navBottom + MARGIN;
        if (shouldDock === docked) return;
        docked = shouldDock;
        heroCta.classList.toggle('is-docked', docked);
        navCta.classList.toggle('visible', docked);
    }

    function requestUpdate() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    update();
});

// ============================================
// Lightbox — visionneuse plein écran des images cliquables
// Même esprit que le zoom du carrousel : l'image grandit depuis sa place
// dans la page, les voisines restent visibles sur les côtés (inclinées,
// transparentes), « ‹ 02 / 05 › » sous l'image.
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const clickableImages = Array.from(document.querySelectorAll('.lightbox-img'));
    if (!clickableImages.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DURATION = reduceMotion ? 0 : 650;
    const SIDE_OPACITY = 0.35;

    const chevron = (dir) =>
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
        'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        (dir < 0 ? '<polyline points="15 6 9 12 15 18"></polyline>' : '<polyline points="9 6 15 12 9 18"></polyline>') +
        '</svg>';

    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Visionneuse d’images');
    overlay.innerHTML =
        '<div class="lightbox-overlay__backdrop"></div>' +
        '<div class="lightbox-overlay__track"></div>' +
        '<button type="button" class="lightbox-overlay__close" aria-label="Fermer">&times;</button>' +
        '<div class="lightbox-overlay__controls">' +
        `<button type="button" class="lightbox-overlay__btn lightbox-overlay__btn--prev" aria-label="Image précédente">${chevron(-1)}</button>` +
        '<span class="lightbox-overlay__count" aria-live="polite"></span>' +
        `<button type="button" class="lightbox-overlay__btn lightbox-overlay__btn--next" aria-label="Image suivante">${chevron(1)}</button>` +
        '</div>';
    document.body.appendChild(overlay);

    const backdrop = overlay.querySelector('.lightbox-overlay__backdrop');
    const track = overlay.querySelector('.lightbox-overlay__track');
    const closeBtn = overlay.querySelector('.lightbox-overlay__close');
    const controls = overlay.querySelector('.lightbox-overlay__controls');
    const prevBtn = overlay.querySelector('.lightbox-overlay__btn--prev');
    const nextBtn = overlay.querySelector('.lightbox-overlay__btn--next');
    const counter = overlay.querySelector('.lightbox-overlay__count');

    let sources = [];   // images de la page parcourues
    let slides = [];    // images affichées dans la visionneuse
    let current = 0;
    let isOpen = false;
    let closeTimer = null;
    let lastFocus = null;

    const pad = (n) => String(n).padStart(2, '0');
    const wrap = (v, n) => ((v % n) + n) % n;
    const offsetOf = (i) => {
        const n = slides.length;
        return wrap(i - current + Math.floor(n / 2), n) - Math.floor(n / 2);
    };

    // Position d'une image selon son écart avec l'image courante :
    // 0 = au centre ; ±1 = sur les côtés, inclinée et transparente ; au-delà = cachée.
    function place(slide, offset, animate) {
        slide.classList.toggle('no-transition', !animate);
        slide.classList.toggle('is-center', offset === 0);
        // écart calculé sur les vraies largeurs : la voisine commence juste
        // après le bord de l'image centrale, sans la chevaucher
        const centerW = slides[current] ? slides[current].offsetWidth : 0;
        const gap = window.innerWidth < 600 ? 16 : 40;
        const shift = centerW / 2 + gap + (slide.offsetWidth * 0.86) / 2;
        let transform;
        let opacity;
        if (offset === 0) {
            transform = 'translate(-50%, -50%)';
            opacity = 1;
        } else {
            const side = Math.sign(offset);
            const far = Math.abs(offset) > 1;
            transform =
                `translate(calc(-50% + ${side * shift * (far ? 1.6 : 1)}px), -50%) ` +
                `rotateY(${-side * 22}deg) scale(0.86)`;
            opacity = far ? 0 : SIDE_OPACITY;
        }
        slide.style.transform = transform;
        slide.style.clipPath = '';   // cadrage complet (valeur du CSS)
        slide.style.opacity = opacity;
        slide.style.visibility = opacity === 0 && !animate ? 'hidden' : 'visible';
        slide.tabIndex = -1;
    }

    function layout(animate, previousOffsets) {
        slides.forEach((slide, i) => {
            const offset = offsetOf(i);
            // une image qui passe d'un bord à l'autre ne doit pas traverser l'écran
            const jumped = previousOffsets && Math.abs(offset - previousOffsets[i]) > 1;
            place(slide, offset, animate && !jumped);
        });
        counter.textContent = `${pad(current + 1)} / ${pad(slides.length)}`;
        controls.style.display = slides.length > 1 ? '' : 'none';
    }

    function go(dir) {
        if (!isOpen || slides.length < 2) return;
        const before = slides.map((_, i) => offsetOf(i));
        current = wrap(current + dir, slides.length);
        layout(true, before);
    }

    // Position + rognage qui superposent exactement l'image centrale à sa
    // vignette dans la page. Les vignettes sont recadrées (object-fit: cover,
    // souvent en carré) alors que la visionneuse montre l'image entière :
    // on agrandit l'image pour qu'elle COUVRE la vignette, puis on la rogne
    // (clip-path) au même cadrage et aux mêmes coins arrondis.
    function fromThumb(slide, thumb) {
        const r = thumb.getBoundingClientRect();
        const visible = r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
        if (!visible) return null;
        // dimensions de l'image centrée, sans transformation (offsetWidth/Height)
        const w = slide.offsetWidth;
        const h = slide.offsetHeight;
        if (!w || !h) return null;
        const scale = Math.max(r.width / w, r.height / h);
        // zone de l'image visible dans la vignette, en pixels de l'image centrée
        const vw = r.width / scale;
        const vh = r.height / scale;
        const cs = getComputedStyle(thumb);
        const [px, py] = (cs.objectPosition || '50% 50%').split(' ')
            .map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5));
        const left = (w - vw) * px;
        const top = (h - vh) * py;
        const right = w - vw - left;
        const bottom = h - vh - top;
        const radius = (parseFloat(cs.borderTopLeftRadius) || 0) / scale;
        // centre de l'image centrée vs centre de la vignette
        // (offsetLeft/Top ignorent la transformation : c'est le point
        //  left 50% / top 46%, où tombe le centre après translate(-50%, -50%))
        const fx = slide.offsetLeft;
        const fy = slide.offsetTop;
        const cx = left + vw / 2 - w / 2;   // décalage du centre de la zone visible
        const cy = top + vh / 2 - h / 2;
        const dx = (r.left + r.width / 2) - (fx + cx * scale);
        const dy = (r.top + r.height / 2) - (fy + cy * scale);
        return {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`,
            clip: `inset(${[top, right, bottom, left].map((v) => Math.max(0, v).toFixed(2) + 'px').join(' ')} round ${radius.toFixed(2)}px)`,
        };
    }
    function applyThumbPose(slide, pose) {
        slide.style.transform = pose.transform;
        slide.style.clipPath = pose.clip;
        slide.style.boxShadow = 'none';
    }
    let hiddenThumb = null;   // vignette masquée pendant que son image voyage
    function hideThumb(thumb) {
        showThumb();
        hiddenThumb = thumb;
        thumb.style.visibility = 'hidden';
    }
    function showThumb() {
        if (hiddenThumb) hiddenThumb.style.visibility = '';
        hiddenThumb = null;
    }

    function open(clickedImg) {
        clearTimeout(closeTimer);
        overlay.classList.remove('closing');
        // ne parcourt que les images visibles dans la page (pas les doublons masqués)
        sources = clickableImages.filter((img) => img.offsetParent !== null);
        if (!sources.includes(clickedImg)) sources = [clickedImg];
        current = sources.indexOf(clickedImg);

        track.innerHTML = '';
        slides = sources.map((img, i) => {
            const slide = document.createElement('img');
            slide.className = 'lightbox-overlay__img';
            slide.src = img.currentSrc || img.src;
            slide.alt = img.alt || '';
            slide.draggable = false;
            // les largeurs ne sont connues qu'une fois l'image chargée
            slide.addEventListener('load', () => { if (isOpen) layout(true); });
            slide.addEventListener('click', (e) => {
                e.stopPropagation();
                const offset = offsetOf(i);
                if (offset === 0) close();
                else go(Math.sign(offset));
            });
            track.appendChild(slide);
            return slide;
        });

        layout(false);
        // les voisines apparaîtront en fondu avec l'ouverture
        slides.forEach((slide, i) => { if (i !== current) slide.style.opacity = '0'; });
        lastFocus = document.activeElement;
        isOpen = true;

        // l'image part de sa vignette et grandit jusqu'au centre
        const center = slides[current];
        const start = () => {
            const from = DURATION ? fromThumb(center, clickedImg) : null;
            if (from) {
                center.classList.add('no-transition');
                applyThumbPose(center, from);
                center.style.opacity = '1';
                hideThumb(clickedImg);
                void center.offsetWidth;
                center.classList.remove('no-transition');
            }
            overlay.classList.add('active');
            // pas de requestAnimationFrame : il ne tourne pas dans un onglet en
            // arrière-plan, et le reflow forcé ci-dessus suffit à lancer la transition
            layout(true);
            center.style.boxShadow = '';
            closeBtn.focus({ preventScroll: true });
        };
        if (center.complete && center.naturalWidth) start();
        else center.addEventListener('load', start, { once: true });
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        const center = slides[current];
        const thumb = sources[current];
        const to = thumb && DURATION ? fromThumb(center, thumb) : null;
        center.classList.remove('no-transition');
        overlay.classList.remove('active');
        overlay.classList.add('closing');
        slides.forEach((slide, i) => {
            if (slide === center) return;
            slide.classList.remove('no-transition');
            slide.style.opacity = '0';
        });
        if (to) {
            // la vignette d'origine reste visible si l'on a changé d'image :
            // on masque celle vers laquelle l'image revient
            hideThumb(thumb);
            applyThumbPose(center, to);
        } else {
            showThumb();
            center.style.opacity = '0';
            center.style.transform = 'translate(-50%, -50%) scale(0.92)';
        }
        closeTimer = setTimeout(() => {
            showThumb();
            overlay.classList.remove('closing');
            track.innerHTML = '';
            slides = [];
        }, DURATION + 50);
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    clickableImages.forEach((img) => img.addEventListener('click', () => open(img)));
    prevBtn.addEventListener('click', () => go(-1));
    nextBtn.addEventListener('click', () => go(1));
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    window.addEventListener('resize', () => { if (isOpen) layout(false); });
    document.addEventListener('keydown', (e) => {
        if (!isOpen) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
    });
});

// ============================================
// Navbar : coins arrondis + ombre quand le panneau clair passe dessous
// ============================================
// Si la page a une barre collante (.sticky-bar, tuto de la page
// rendez-vous), c'est elle qui porte les coins, juste sous la navbar.
document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar');
    const panel  = document.querySelector('.main-content, .page-panel, .contact-page, .rdv-page, .mentions-page');
    if (!navbar || !panel) return;
    const bar  = document.querySelector('.sticky-bar');
    const edge = bar || navbar;   // élément sous lequel le panneau passe
    const root = document.documentElement;

    const update = () => {
        // la barre glisse de 2 px sous la navbar : sinon un fin trait clair
        // apparaît à la jonction (bord de la navbar à un demi-pixel)
        root.style.setProperty('--navbar-h', (Math.floor(navbar.getBoundingClientRect().height) - 2) + 'px');
        const limit = navbar.offsetHeight + (bar ? bar.offsetHeight : 0);
        const overlap = panel.getBoundingClientRect().top <= limit + 1;
        edge.classList.toggle('navbar--overlap', overlap);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
});


// ============================================
// Pied de page : en bas de la page, le fond du document prend la
// couleur du pied de page, pour que le rebond du scroll (macOS, iOS)
// le prolonge au lieu de laisser apparaître le violet.
// ============================================
(() => {
    const root = document.documentElement;
    const update = () => {
        root.classList.toggle('is-at-bottom', window.scrollY > (root.scrollHeight - window.innerHeight) / 2);
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
})();


/* ============================================
   FLÈCHES ENTRE LES BLOCS — tracé animé
   Chaque <img> .flow-arrow est remplacée par le SVG en ligne
   (même fichier, une seule source). Le trait en pointillés est
   révélé par un masque dont le tracé plein « avance » le long
   du chemin (stroke-dashoffset), puis le chevron apparaît.
   Déclenché quand la flèche entre à l'écran (sauf .flow-arrow--onload,
   la flèche du haut, tracée dès le chargement). Sans JS, ou si le
   chargement échoue, l'image fixe reste affichée.
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    const arrows = document.querySelectorAll('.flow-arrow');
    if (!arrows.length || !('IntersectionObserver' in window)) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const svgCache = {};
    const NS = 'http://www.w3.org/2000/svg';
    let uid = 0;

    const loadSvg = (src) => {
        if (!svgCache[src]) {
            svgCache[src] = fetch(src).then(r => {
                if (!r.ok) throw new Error(r.status);
                return r.text();
            });
        }
        return svgCache[src];
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-drawn');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.6, rootMargin: '0px 0px -60px 0px' });

    arrows.forEach(arrow => {
        const img = arrow.querySelector('img');
        if (!img) return;

        loadSvg(img.getAttribute('src')).then(text => {
            const svg = new DOMParser()
                .parseFromString(text, 'image/svg+xml')
                .documentElement;
            const [line, head] = svg.querySelectorAll('path');
            if (!line || !head) return;

            // masque : copie pleine et plus épaisse du chemin, tracée progressivement
            const id = 'flow-arrow-mask-' + (++uid);
            const mask = document.createElementNS(NS, 'mask');
            mask.setAttribute('id', id);
            mask.setAttribute('maskUnits', 'userSpaceOnUse');
            const reveal = document.createElementNS(NS, 'path');
            reveal.setAttribute('d', line.getAttribute('d'));
            reveal.setAttribute('pathLength', '1');
            reveal.setAttribute('stroke', '#fff');
            reveal.setAttribute('stroke-width', '8');
            reveal.setAttribute('class', 'flow-arrow__reveal');
            mask.appendChild(reveal);
            svg.insertBefore(mask, svg.firstChild);

            line.setAttribute('mask', `url(#${id})`);
            head.setAttribute('class', 'flow-arrow__head');
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');

            img.replaceWith(document.importNode(svg, true));

            if (reduceMotion) {
                arrow.classList.add('is-drawn');
            } else if (arrow.classList.contains('flow-arrow--onload')) {
                // flèche du haut de page : se trace dès le chargement,
                // sans attendre le scroll. Lire une dimension force le
                // navigateur à appliquer l'état « non tracé » d'abord,
                // pour que la transition joue.
                void arrow.getBoundingClientRect();
                arrow.classList.add('is-drawn');
            } else {
                observer.observe(arrow);
            }
        }).catch(() => { /* on garde l'image fixe */ });
    });
});

// ============================================
// Navbar : si l'écran est trop étroit pour afficher le nom
// « Myrtille Raverdy » sur une ligne à côté des boutons, on le met
// sur 2 lignes (.navbar--name-2l) ; et si ça ne tient toujours pas,
// on ne garde que le colibri (.navbar--compact).
// ============================================
(() => {
    const navbar = document.querySelector('.navbar');
    if (!navbar || !navbar.querySelector('.nav-brand__name')) return;
    const fit = () => {
        const name = navbar.querySelector('.nav-brand__name');
        const btns = navbar.querySelectorAll('.btn');
        // trop serré si le nom touche le 1er bouton, ou si le dernier bouton
        // mord sur la marge droite de la barre
        const overflows = () => {
            if (!btns.length) return navbar.scrollWidth > navbar.clientWidth;
            const cs = getComputedStyle(navbar);
            const limit = navbar.getBoundingClientRect().right - parseFloat(cs.paddingRight);
            return name.getBoundingClientRect().right + 8 > btns[0].getBoundingClientRect().left ||
                btns[btns.length - 1].getBoundingClientRect().right > limit + 0.5;
        };
        navbar.classList.remove('navbar--name-2l', 'navbar--compact');
        if (!overflows()) return;                       // 1 ligne
        navbar.classList.add('navbar--name-2l');
        if (!overflows()) return;                       // 2 lignes
        navbar.classList.replace('navbar--name-2l', 'navbar--compact'); // colibri seul
    };
    fit();
    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();
