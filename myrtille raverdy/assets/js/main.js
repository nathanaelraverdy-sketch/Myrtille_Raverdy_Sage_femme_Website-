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
