const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxNln1GhKA22Gz7gbp5vSp03cMOIgTm3tBXXpYeOrjiaaTRpPdfASrmUe-I3WxwIx4m/exec';

document.addEventListener('DOMContentLoaded', () => {

    const emailInput = document.getElementById('contact-email');
    const emailError = document.getElementById('contact-email-error');
    const btnEnvoyer = document.getElementById('btn-envoyer');

    emailInput.addEventListener('blur', () => {
        const val   = emailInput.value.trim();
        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        if (val && !valid) emailError.classList.add('visible');
        else emailError.classList.remove('visible');
    });

    emailInput.addEventListener('input', () => emailError.classList.remove('visible'));

    btnEnvoyer.addEventListener('click', async () => {

        const email   = emailInput.value.trim();
        const objet   = document.getElementById('contact-objet').value.trim();
        const message = document.getElementById('contact-message').value.trim();
        const valid   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        if (!email || !valid) {
            emailError.classList.add('visible');
            emailInput.focus();
            return;
        }
        if (!objet) {
            alert('Veuillez indiquer un objet.');
            return;
        }
        if (!message) {
            alert('Veuillez écrire un message.');
            return;
        }

        btnEnvoyer.disabled    = true;
        btnEnvoyer.textContent = 'Envoi en cours…';

        try {
            await fetch(APPS_SCRIPT_URL, {
                method:  'POST',
                mode:    'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body:    JSON.stringify({
                    type:    'contact',
                    email:   email,
                    objet:   objet,
                    message: message
                })
            });

            document.getElementById('contact-confirmation-text').innerHTML =
                'Votre message a bien été envoyé.<br>'
                + 'Myrtille vous répondra dans les plus brefs délais à <strong>' + email + '</strong>.';

            document.getElementById('contact-confirmation').style.display = 'block';
            document.getElementById('contact-form').style.opacity = '0.4';
            document.getElementById('contact-form').style.pointerEvents = 'none';
            btnEnvoyer.textContent = 'Envoyé ✓';

        } catch (err) {
            console.error('Erreur envoi contact :', err);
            alert('Une erreur est survenue. Veuillez réessayer ou nous contacter directement par email.');
            btnEnvoyer.disabled    = false;
            btnEnvoyer.textContent = 'Envoyer';
        }
    });
});