/* ============================================
   PLANTES.JS — les plantes décoratives poussent au fil du scroll
   Chaque plante (.plante) reçoit une variable CSS --pousse entre 0 et 1 :
   0 quand sa racine entre par le bas de l'écran, 1 quand elle atteint
   le milieu. Le CSS (style.css) en fait un étirement depuis la racine.
   Une plante ne pousse qu'une fois : en remontant la page, elle reste entière.
   La pousse est lissée image par image et ne peut pas aller plus vite
   qu'une durée minimale : même en scrollant très vite, elle reste fluide.
   Une plante attend que sa carte (.reveal) ait fini d'apparaître : pendant
   le fondu, la carte forme un calque à part et la plante passerait devant.
   Si l'utilisateur demande moins d'animations, les plantes restent entières.
   ============================================ */
(() => {
    const plantes = [...document.querySelectorAll('.plante')];
    if (!plantes.length) return;

    const moinsAnim = window.matchMedia('(prefers-reduced-motion: reduce)');
    document.documentElement.classList.add('plantes-scroll');

    // durée minimale d'une pousse complète (0 → 1), en secondes
    const DUREE_MIN = 0.9;
    // lissage : temps de rattrapage de la valeur cible (plus grand = plus doux)
    const DOUCEUR = 0.22;

    // position de la racine (bas de la plante), sans tenir compte de
    // l'agrandissement en cours : offsetTop/offsetHeight ignorent les transforms
    function racineY(p) {
        const parent = p.offsetParent;
        if (!parent) return null;            // plante masquée (display: none)
        return parent.getBoundingClientRect().top + p.offsetTop + p.offsetHeight * 0.95;
    }

    // cible = plus grande pousse atteinte selon le scroll ; actuel = valeur affichée
    const cible = new Map(plantes.map(p => [p, 0]));
    const actuel = new Map(plantes.map(p => [p, 0]));

    // carte qui apparaît en fondu autour de la plante (main.js ajoute .visible)
    const carte = new Map(plantes.map(p => [p, p.closest('.reveal')]));
    function carteApparue(p) {
        const c = carte.get(p);
        return !c || (c.classList.contains('visible') && getComputedStyle(c).opacity === '1');
    }
    // dès qu'une carte a fini son fondu, ses plantes peuvent pousser
    new Set(carte.values()).forEach(c => c && c.addEventListener('transitionend', demander));

    function majCibles() {
        const vh = window.innerHeight;
        for (const p of plantes) {
            if (moinsAnim.matches) { cible.set(p, 1); continue; }
            if (!carteApparue(p)) continue;  // reste à 0 en attendant
            const y = racineY(p);
            if (y === null) continue;
            // début de la pousse : racine à 95 % de la hauteur de l'écran ;
            // plante entière quand la racine arrive à 55 %
            let t = (vh * 0.95 - y) / (vh * 0.4);
            t = Math.min(1, Math.max(0, t));
            // la plante ne pousse qu'une fois : elle ne rapetisse jamais
            cible.set(p, Math.max(t, cible.get(p)));
        }
    }

    let enCours = false;
    let tPrec = 0;
    function image(now) {
        const dt = Math.min(0.05, (now - tPrec) / 1000 || 0.016);
        tPrec = now;
        let reste = false;
        for (const p of plantes) {
            const c = cible.get(p);
            let v = actuel.get(p);
            if (moinsAnim.matches) v = 1;
            else if (v < c) {
                // rattrapage en douceur, plafonné en vitesse
                const pas = Math.min((c - v) * (1 - Math.exp(-dt / DOUCEUR)) + 0.002, dt / DUREE_MIN);
                v = Math.min(c, v + pas);
            }
            if (v !== actuel.get(p)) {
                actuel.set(p, v);
                const affiche = 1 - Math.pow(1 - v, 2);   // démarre vite, finit en douceur
                p.style.setProperty('--pousse', affiche.toFixed(4));
            }
            if (v < c) reste = true;
        }
        if (reste) requestAnimationFrame(image);
        else enCours = false;
    }
    function demander() {
        majCibles();
        if (!enCours) {
            enCours = true;
            tPrec = performance.now();
            requestAnimationFrame(image);
        }
    }

    plantes.forEach(p => p.style.setProperty('--pousse', moinsAnim.matches ? '1' : '0'));
    // au chargement, les plantes déjà à l'écran poussent en douceur
    setTimeout(demander, 500);

    window.addEventListener('scroll', demander, { passive: true });
    window.addEventListener('resize', demander);
    moinsAnim.addEventListener?.('change', demander);
})();
