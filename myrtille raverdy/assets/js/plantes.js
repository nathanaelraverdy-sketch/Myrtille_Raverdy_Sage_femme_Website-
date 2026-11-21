/* ============================================
   PLANTES.JS — les plantes décoratives poussent au fil du scroll
   Chaque plante (.plante) reçoit une variable CSS --pousse entre 0 et 1 :
   0 quand sa racine entre par le bas de l'écran, 1 quand elle atteint
   le milieu. Le CSS (style.css) en fait un étirement depuis la racine.
   Une plante ne pousse qu'une fois : en remontant la page, elle reste entière.
   Si l'utilisateur demande moins d'animations, les plantes restent entières.
   ============================================ */
(() => {
    const plantes = [...document.querySelectorAll('.plante')];
    if (!plantes.length) return;

    const moinsAnim = window.matchMedia('(prefers-reduced-motion: reduce)');
    const racine = document.documentElement;
    racine.classList.add('plantes-scroll', 'plantes-intro');

    // position de la racine (bas de la plante), sans tenir compte de
    // l'agrandissement en cours : offsetTop/offsetHeight ignorent les transforms
    function racineY(p) {
        const parent = p.offsetParent;
        if (!parent) return null;            // plante masquée (display: none)
        return parent.getBoundingClientRect().top + p.offsetTop + p.offsetHeight * 0.95;
    }

    const dejaPousse = new Map();
    let enAttente = false;
    function maj() {
        enAttente = false;
        const vh = window.innerHeight;
        for (const p of plantes) {
            if (moinsAnim.matches) { p.style.setProperty('--pousse', '1'); continue; }
            const y = racineY(p);
            if (y === null) continue;
            // début de la pousse : racine à 95 % de la hauteur de l'écran ;
            // plante entière quand la racine arrive à 55 %
            let t = (vh * 0.95 - y) / (vh * 0.4);
            t = Math.min(1, Math.max(0, t));
            t = 1 - Math.pow(1 - t, 2);      // démarre vite, finit en douceur
            // la plante ne pousse qu'une fois : elle garde sa plus grande
            // taille atteinte et ne rapetisse pas quand on remonte la page
            t = Math.max(t, dejaPousse.get(p) || 0);
            dejaPousse.set(p, t);
            p.style.setProperty('--pousse', t.toFixed(3));
        }
    }
    function demander() {
        if (!enAttente) { enAttente = true; requestAnimationFrame(maj); }
    }

    // au chargement, les plantes déjà à l'écran poussent en douceur
    plantes.forEach(p => p.style.setProperty('--pousse', '0'));
    setTimeout(() => {
        maj();
        // ensuite, transition courte : la plante suit le doigt / la molette
        setTimeout(() => racine.classList.remove('plantes-intro'), 1400);
    }, 500);

    window.addEventListener('scroll', demander, { passive: true });
    window.addEventListener('resize', demander);
    moinsAnim.addEventListener?.('change', demander);
})();
