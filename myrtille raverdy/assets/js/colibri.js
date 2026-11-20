/* ============================================
   COLIBRI.JS — Envol du colibri de la navbar
   Myrtille Raverdy — Sage-femme à Lausanne

   À l'arrivée sur le site (1re page vue de la visite), le colibri du logo
   se réveille, prend son envol au-dessus de la page, fait du sur-place,
   se retourne, revient et se repose à sa place dans la navbar.

   - Joué une seule fois par visite (sessionStorage) : pas à chaque page.
   - Ajouter ?colibri à l'adresse pour le revoir, ou appeler
     colibriEnvol() dans la console.
   - Rien ne se passe si l'utilisateur a demandé à réduire les animations.

   Technique : tout est dessiné dans un <canvas> posé au-dessus de la page
   (sans bloquer les clics). Le PNG du logo est découpé en deux calques —
   le corps et l'aile — pour faire battre l'aile autour de l'épaule.
   Le vrai logo est masqué pendant le vol et réapparaît au moment exact
   où le colibri dessiné se pose dessus.
   ============================================ */

(function () {
    'use strict';

    const logo = document.querySelector('.nav-brand__logo');
    if (!logo) return;

    const STORAGE_KEY = 'colibriVu';

    // ---------- Géométrie du PNG (433 × 433 px) ----------
    const REF = 433;
    const PIVOT = [200, 160];                 // épaule : centre de rotation de l'aile
    // Aile : tout ce qui est à gauche de la jointure aile/dos,
    // de (214,116) en haut à (179,201) en bas.
    const WING_POLY = [[0, 0], [214, 0], [214, 116], [179, 201], [0, 201]];
    const ROOT_DISC = 22;                     // base de l'aile, cachée sous le corps
    const TAIL = [-0.08, 0.26];               // queue, en fraction de la taille (d'où partent les paillettes)

    // ---------- Chorégraphie (secondes) ----------
    const TL = {
        wake: 0.55,    // réveil : les ailes se mettent à battre sur place
        take: 1.75,    // envol vers le milieu de l'écran
        hover: 2.85,   // sur-place (avec un petit écart vif)
        turn1: 3.2,    // demi-tour
        ret: 4.35,     // retour vers la navbar
        turn2: 4.85,   // se retourne pour faire face comme le logo
        land: 5.6      // se pose
    };

    // ---------- Petits outils ----------
    const clamp01 = v => Math.max(0, Math.min(1, v));
    const lerp = (a, b, k) => a + (b - a) * k;
    const lerpP = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
    const smooth = k => { k = clamp01(k); return k * k * (3 - 2 * k); };
    const easeOutCubic = k => 1 - Math.pow(1 - clamp01(k), 3);
    const easeInOutCubic = k => { k = clamp01(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    const easeInOutSine = k => -(Math.cos(Math.PI * clamp01(k)) - 1) / 2;
    const bez = (p0, p1, p2, p3, t) => {
        const u = 1 - t;
        return {
            x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
            y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
        };
    };
    const rand = (a, b) => a + Math.random() * (b - a);
    const TAU = Math.PI * 2;

    // ---------- Découpe du logo en deux calques ----------
    function makeLayers(img) {
        const n = img.naturalWidth || REF;
        const k = n / REF;
        const make = clip => {
            const c = document.createElement('canvas');
            c.width = c.height = n;
            const x = c.getContext('2d');
            x.scale(k, k);
            clip(x);
            x.setTransform(1, 0, 0, 1, 0, 0);
            x.drawImage(img, 0, 0, n, n);
            return c;
        };
        const poly = x => {
            WING_POLY.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
            x.closePath();
        };
        const wing = make(x => {
            x.beginPath();
            poly(x);
            x.moveTo(PIVOT[0] + ROOT_DISC, PIVOT[1]);
            x.arc(PIVOT[0], PIVOT[1], ROOT_DISC, 0, TAU);
            x.clip();
        });
        const body = make(x => {
            x.beginPath();
            x.rect(0, 0, REF, REF);
            poly(x);
            x.clip('evenodd');
        });
        return { wing, body, n };
    }

    // ---------- Trajectoire : pose du colibri à l'instant t ----------
    // Fonction pure du temps : position (centre de l'image), taille,
    // orientation (1 = vers la droite, -1 = vers la gauche, entre les deux = il tourne),
    // fréquence et amplitude du battement d'ailes.
    function pose(t, g) {
        const { W, H, T, sT, S } = g;
        const W0 = { x: T.x, y: T.y - sT * 0.3 };
        const H1 = { x: W * 0.6, y: Math.max(H * 0.4, T.y + S * 1.4) };
        const D = { x: H1.x + W * 0.035, y: H1.y - H * 0.03 };            // après le petit écart
        const Q = { x: T.x + sT * 1.9 + W * 0.02, y: T.y + sT * 0.9 };    // retour : sous le nom
        const A = { x: T.x, y: T.y - sT * 0.55 };                         // juste au-dessus du logo

        // léger flottement, présent seulement pendant le sur-place
        const bobK = smooth((t - TL.take) / 0.35) * (1 - smooth((t - (TL.turn1 - 0.25)) / 0.25));
        const bob = {
            x: Math.sin(TAU * 0.8 * t + 1) * S * 0.03 * bobK,
            y: Math.sin(TAU * 1.5 * t) * S * 0.05 * bobK
        };

        let p, s, facing = 1, sy = 1, freq = 15, amp = 1, env = 1, fx = 1;

        if (t < TL.wake) {
            const k = t / TL.wake, e = easeOutCubic(k);
            p = lerpP(T, W0, e);
            s = sT * (1 + 0.08 * e);
            freq = 4 + 12 * k;
            amp = smooth(k * 1.3);
            fx = e;
        } else if (t < TL.take) {
            const k = (t - TL.wake) / (TL.take - TL.wake);
            const C1 = { x: T.x + W * 0.14, y: T.y + H * 0.02 };
            const C2 = { x: H1.x - W * 0.22, y: H1.y + H * 0.3 };
            p = bez(W0, C1, C2, H1, easeInOutCubic(k));
            s = lerp(sT * 1.08, S, easeOutCubic(k));
            freq = 14;
        } else if (t < TL.hover) {
            const dart = smooth((t - 2.2) / 0.16);                        // écart vif, typique du colibri
            p = lerpP(H1, D, dart);
            s = S;
            freq = 16;
        } else if (t < TL.turn1) {
            const k = (t - TL.hover) / (TL.turn1 - TL.hover);
            p = { x: D.x, y: D.y - H * 0.012 * Math.sin(Math.PI * k) };
            s = S;
            facing = Math.cos(Math.PI * easeInOutSine(k));
            sy = 1 + 0.06 * Math.sin(Math.PI * k);
            freq = 16;
        } else if (t < TL.ret) {
            const k = (t - TL.turn1) / (TL.ret - TL.turn1);
            // aller par le bas, retour par le haut : le trajet dessine une boucle
            const C3 = { x: D.x - W * 0.06, y: Math.max(T.y + S * 0.9, D.y - H * 0.34) };
            const C4 = { x: Q.x + W * 0.3, y: Q.y + H * 0.03 };
            p = bez(D, C3, C4, Q, easeInOutCubic(k));
            s = lerp(S, sT * 1.6, easeInOutSine(k));
            facing = -1;
            freq = 13;
        } else if (t < TL.turn2) {
            const k = (t - TL.ret) / (TL.turn2 - TL.ret), e = easeInOutSine(k);
            p = lerpP(Q, A, e);
            s = lerp(sT * 1.6, sT * 1.15, e);
            facing = -Math.cos(Math.PI * e);
            sy = 1 + 0.05 * Math.sin(Math.PI * k);
            freq = 16;
        } else {
            const k = clamp01((t - TL.turn2) / (TL.land - TL.turn2));
            p = lerpP(A, T, easeInOutSine(k));
            s = lerp(sT * 1.15, sT, easeOutCubic(k));
            freq = lerp(16, 3.5, k);                                      // les ailes ralentissent…
            env = 1 - smooth((k - 0.45) / 0.55);                          // …puis se replient
            sy = 1 - 0.05 * Math.sin(Math.PI * clamp01((k - 0.8) / 0.2)); // petit tassement à l'atterrissage
            fx = 1 - smooth(k);
        }

        return { x: p.x + bob.x, y: p.y + bob.y, s, facing, sy, freq, amp, env, fx };
    }

    // ---------- Animation ----------
    function play() {
        if (play.running) return;
        play.running = true;

        let layers;
        try { layers = makeLayers(logo); } catch (e) { play.running = false; return; }

        const cv = document.createElement('canvas');
        cv.setAttribute('aria-hidden', 'true');
        cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1000';
        document.body.appendChild(cv);
        const ctx = cv.getContext('2d');

        const buf = document.createElement('canvas');          // le colibri seul, avant ombre/halo
        const bctx = buf.getContext('2d');

        let dpr = 1;
        const geom = () => {
            const W = window.innerWidth, H = window.innerHeight;
            const r = logo.getBoundingClientRect();
            const sT = r.height || 32;
            return {
                W, H, sT,
                T: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
                S: Math.max(64, Math.min(128, Math.min(W, H) * 0.16))
            };
        };
        const resize = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            cv.width = Math.round(window.innerWidth * dpr);
            cv.height = Math.round(window.innerHeight * dpr);
            const side = Math.ceil(geom().S * 1.5 * dpr);
            if (buf.width !== side) buf.width = buf.height = side;
        };
        resize();
        window.addEventListener('resize', resize);

        const brand = logo.closest('.nav-brand');
        logo.style.visibility = 'hidden';

        let t = 0, last = 0, phase = 0, landed = false, emitAcc = 0, prev = null, pitch = 0;
        const particles = [];
        const rings = [];

        // --- paillettes ---
        const COLORS = ['255,255,255', '246,240,255', '224,210,255', '255,236,248'];
        function spawn(x, y, vx, vy, big) {
            particles.push({
                x, y, vx, vy,
                age: 0,
                life: rand(0.9, 1.6),
                size: big ? rand(1.2, 2) : rand(0.6, 1.4),
                peak: rand(0.35, 0.7),
                color: COLORS[(Math.random() * COLORS.length) | 0]
            });
        }
        function burst(x, y, count, speed, big) {
            for (let i = 0; i < count; i++) {
                const a = TAU * i / count + rand(-0.2, 0.2), v = rand(speed * 0.6, speed);
                spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, big);
            }
        }

        // --- traînée : un filet de lumière qui suit le colibri et s'efface ---
        const trail = [];
        function drawTrail(dt, head) {
            trail.forEach(pt => { pt.age += dt; });
            if (head) trail.push({ x: head.x, y: head.y, w: head.w, age: 0 });
            while (trail.length && trail[0].age > 0.45) trail.shift();
            if (trail.length < 2) return;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';
            for (let i = 1; i < trail.length; i++) {
                const a = trail[i - 1], b = trail[i];
                const k = 1 - b.age / 0.45;                 // 1 près de l'oiseau, 0 au bout
                ctx.strokeStyle = `rgba(255,255,255,${0.28 * k * k})`;
                ctx.lineWidth = Math.max(0.5, b.w * k);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
            ctx.restore();
        }

        function drawParticles(dt) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = particles.length - 1; i >= 0; i--) {
                const q = particles[i];
                q.age += dt;
                if (q.age >= q.life) { particles.splice(i, 1); continue; }
                q.vx *= Math.pow(0.2, dt);
                q.vy = q.vy * Math.pow(0.2, dt) + 12 * dt;           // flottent, retombent à peine
                q.x += q.vx * dt;
                q.y += q.vy * dt;
                const k = q.age / q.life;
                const a = q.peak * Math.sin(Math.PI * Math.min(1, k * 2.5)) * (1 - k) * (1 - k);
                // petite poussière de lumière : un point net entouré d'un halo flou
                const r = q.size * 3;
                const grd = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
                grd.addColorStop(0, `rgba(${q.color},${a})`);
                grd.addColorStop(0.25, `rgba(${q.color},${a * 0.45})`);
                grd.addColorStop(1, `rgba(${q.color},0)`);
                ctx.fillStyle = grd;
                ctx.beginPath();
                ctx.arc(q.x, q.y, r, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
        }

        function drawRings(dt, g) {
            for (let i = rings.length - 1; i >= 0; i--) {
                const r = rings[i];
                r.age += dt;
                if (r.age < 0) continue;
                const k = r.age / 0.9;
                if (k >= 1) { rings.splice(i, 1); continue; }
                const e = easeOutCubic(k);
                // onde douce : un anneau flou qui s'élargit et s'efface
                const rad = g.sT * (0.5 + 1.6 * e);
                const grd = ctx.createRadialGradient(g.T.x, g.T.y, rad * 0.6, g.T.x, g.T.y, rad);
                grd.addColorStop(0, 'rgba(255,255,255,0)');
                grd.addColorStop(0.85, `rgba(255,255,255,${0.35 * (1 - k)})`);
                grd.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = grd;
                ctx.beginPath();
                ctx.arc(g.T.x, g.T.y, rad, 0, TAU);
                ctx.fill();
            }
        }

        // --- le colibri : corps + aile battante (avec flou de mouvement) ---
        function drawBird(p, pitchRad) {
            const side = buf.width;
            const n = layers.n;
            const sc = p.s * dpr / n;
            bctx.setTransform(1, 0, 0, 1, 0, 0);
            bctx.clearRect(0, 0, side, side);
            bctx.imageSmoothingQuality = 'high';
            bctx.translate(side / 2, side / 2);
            bctx.rotate(pitchRad);
            bctx.scale(p.facing * sc, p.sy * sc);
            bctx.translate(-n / 2, -n / 2);

            const k = n / REF;
            const px = PIVOT[0] * k, py = PIVOT[1] * k;
            const w = p.env * p.amp;
            // aile : +25° (haut) à -45° (bas) ; plusieurs positions superposées
            // sur la durée d'une image pour donner le flou d'un battement rapide
            const spread = TAU * p.freq / 60;
            const ALPHAS = [1, 0.42, 0.3, 0.2, 0.12];
            for (let i = ALPHAS.length - 1; i >= 0; i--) {
                const ph = phase - spread * i / (ALPHAS.length - 1);
                const sin = Math.sin(ph);
                const ang = w * (-0.17 + 0.61 * sin);
                const sq = 1 - 0.18 * w * (0.5 - 0.5 * sin);
                bctx.save();
                bctx.globalAlpha = ALPHAS[i];
                bctx.translate(px, py);
                bctx.rotate(ang);
                bctx.scale(1, sq);
                bctx.translate(-px, -py);
                bctx.drawImage(layers.wing, 0, 0);
                bctx.restore();
            }
            bctx.drawImage(layers.body, 0, 0);

            const half = side / 2 / dpr;
            // halo lumineux
            if (p.fx > 0.01) {
                const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 0.85);
                grd.addColorStop(0, `rgba(255,255,255,${0.22 * p.fx})`);
                grd.addColorStop(1, 'rgba(235,222,255,0)');
                ctx.fillStyle = grd;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.s * 0.85, 0, TAU);
                ctx.fill();
            }
            // ombre douce : lisible aussi sur les fonds clairs
            ctx.save();
            ctx.shadowColor = `rgba(58,38,102,${0.32 * p.fx})`;
            ctx.shadowBlur = p.s * 0.14 * dpr;
            ctx.shadowOffsetY = p.s * 0.05 * dpr;
            ctx.drawImage(buf, p.x - half, p.y - half, half * 2, half * 2);
            ctx.restore();
        }

        function finish() {
            window.removeEventListener('resize', resize);
            cv.remove();
            logo.style.visibility = '';
            play.running = false;
        }

        function frame(now) {
            try {
                const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
                last = now;
                t += dt;
                const g = geom();

                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, cv.width, cv.height);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                if (!landed) {
                    const tt = Math.min(t, TL.land);
                    const p = pose(tt, g);
                    phase += TAU * p.freq * dt;

                    // inclinaison selon la vitesse : bec vers l'avant en vol rapide
                    if (prev) {
                        const vx = (p.x - prev.x) / dt, vy = (p.y - prev.y) / dt;
                        const target = (Math.max(-1, Math.min(1, vx / (g.W * 0.8))) * 0.42
                            + p.facing * Math.max(-1, Math.min(1, vy / (g.H * 0.8))) * 0.2) * p.fx;
                        pitch += (target - pitch) * Math.min(1, dt * 10);
                        // fine poussière de lumière, discrète, derrière le colibri
                        const speed = Math.hypot(vx, vy);
                        emitAcc += dt * (tt > TL.wake && tt < TL.turn2 ? 5 + Math.min(22, speed / g.W * 30) : 0);
                        while (emitAcc >= 1) {
                            emitAcc -= 1;
                            spawn(
                                p.x + p.facing * TAIL[0] * p.s + rand(-0.08, 0.08) * p.s,
                                p.y + TAIL[1] * p.s * 0.6 + rand(-0.08, 0.08) * p.s,
                                -vx * 0.06 + rand(-12, 12), -vy * 0.06 + rand(-12, 12)
                            );
                        }
                    }
                    if (prev && prev.t < TL.wake && tt >= TL.wake) burst(p.x, p.y + p.s * 0.1, 6, 40, false);
                    prev = { x: p.x, y: p.y, t: tt };
                    pitch *= tt >= TL.turn2 ? 1 - smooth((tt - TL.turn2) / (TL.land - TL.turn2)) : 1;

                    // la traînée part du milieu du corps et s'amincit à l'atterrissage
                    const trailOn = tt > TL.wake ? p.fx * smooth((tt - TL.wake) / 0.3) : 0;
                    drawTrail(dt, trailOn > 0.02 ? { x: p.x - p.facing * p.s * 0.05, y: p.y + p.s * 0.12, w: p.s * 0.045 * trailOn } : null);
                    drawParticles(dt);
                    drawBird(p, pitch);

                    if (t >= TL.land) {
                        // posé : le vrai logo reprend sa place, exactement au même endroit
                        landed = true;
                        logo.style.visibility = '';
                        rings.push({ age: 0 });
                        burst(g.T.x, g.T.y, 10, 55, true);
                        if (brand) {
                            brand.classList.remove('nav-brand--glow');
                            void brand.offsetWidth;
                            brand.classList.add('nav-brand--glow');
                            brand.addEventListener('animationend', () => brand.classList.remove('nav-brand--glow'), { once: true });
                        }
                    }
                } else {
                    drawTrail(dt, null);
                    drawParticles(dt);
                }
                drawRings(dt, g);

                if (landed && !particles.length && !rings.length && trail.length < 2) finish();
                else requestAnimationFrame(frame);
            } catch (err) {
                finish();
            }
        }
        requestAnimationFrame(frame);
    }

    window.colibriEnvol = play;

    // ---------- Quand jouer ----------
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const force = /[?&]colibri\b/.test(location.search);
    try {
        if (sessionStorage.getItem(STORAGE_KEY) && !force) return;
        sessionStorage.setItem(STORAGE_KEY, '1');
    } catch (e) { /* stockage indisponible : on joue quand même */ }

    const ready = new Promise(resolve => {
        if (logo.complete && logo.naturalWidth) return resolve();
        logo.addEventListener('load', resolve, { once: true });
    });
    ready.then(() => {
        const go = () => setTimeout(play, 450);
        if (document.hidden) {
            const onVisible = () => {
                if (document.hidden) return;
                document.removeEventListener('visibilitychange', onVisible);
                go();
            };
            document.addEventListener('visibilitychange', onVisible);
        } else {
            go();
        }
    });
})();
