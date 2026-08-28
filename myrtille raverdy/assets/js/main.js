/* ============================================
   MAIN.JS — Scripts globaux
   Myrtille Raverdy — Sage-femme à Lausanne
   ============================================ */


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
// Bouton "Prendre rendez-vous" flottant dans la navbar
// Apparaît quand on scrolle sous le bouton du hero
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const heroCta = document.getElementById('hero-cta');
    const navCta = document.getElementById('nav-cta');

    if (heroCta && navCta) {
        const navCtaObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const scrolledPast = !entry.isIntersecting && entry.boundingClientRect.top < 0;
                navCta.classList.toggle('visible', scrolledPast);
            });
        }, { threshold: 0 });

        navCtaObserver.observe(heroCta);
    }
});

// ============================================
// Lightbox — agrandissement des images cliquables
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const clickableImages = document.querySelectorAll('.lightbox-img');
    if (!clickableImages.length) return;

    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    const chevronSvg = (direction) =>
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
        'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        (direction === 'prev' ? '<polyline points="15 6 9 12 15 18"></polyline>' : '<polyline points="9 6 15 12 9 18"></polyline>') +
        '</svg>';

    overlay.innerHTML =
        '<button class="lightbox-overlay__close" aria-label="Fermer">&times;</button>' +
        '<button class="lightbox-overlay__nav lightbox-overlay__nav--prev" aria-label="Image précédente">' + chevronSvg('prev') + '</button>' +
        '<img src="" alt="" />' +
        '<button class="lightbox-overlay__nav lightbox-overlay__nav--next" aria-label="Image suivante">' + chevronSvg('next') + '</button>';
    document.body.appendChild(overlay);

    const overlayImg = overlay.querySelector('img');
    const closeBtn   = overlay.querySelector('.lightbox-overlay__close');
    const prevBtn    = overlay.querySelector('.lightbox-overlay__nav--prev');
    const nextBtn    = overlay.querySelector('.lightbox-overlay__nav--next');

    let gallery = [];
    let currentIndex = 0;

    const showIndex = (index) => {
        if (!gallery.length) return;
        currentIndex = (index + gallery.length) % gallery.length;
        const img = gallery[currentIndex];
        overlayImg.src = img.currentSrc || img.src;
        overlayImg.alt = img.alt || '';
        const showNav = gallery.length > 1;
        prevBtn.style.display = showNav ? '' : 'none';
        nextBtn.style.display = showNav ? '' : 'none';
    };

    const openLightbox = (clickedImg) => {
        // Ne navigue qu'entre les images actuellement visibles à l'écran
        gallery = Array.from(clickableImages).filter(img => img.offsetParent !== null);
        if (!gallery.includes(clickedImg)) gallery = [clickedImg];
        showIndex(gallery.indexOf(clickedImg));
        overlay.classList.add('active');
    };
    const closeLightbox = () => {
        overlay.classList.remove('active');
    };

    clickableImages.forEach(img => {
        img.addEventListener('click', () => openLightbox(img));
    });

    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showIndex(currentIndex - 1); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showIndex(currentIndex + 1); });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target === closeBtn) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
        if (!overlay.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') showIndex(currentIndex - 1);
        if (e.key === 'ArrowRight') showIndex(currentIndex + 1);
    });
});
