document.addEventListener('DOMContentLoaded', () => {

    const emailInput  = document.getElementById('contact-email');
    const emailError  = document.getElementById('contact-email-error');
    const btnEnvoyer  = document.getElementById('btn-envoyer');


    emailInput.addEventListener('blur', () => {
        const val   = emailInput.value.trim();
        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        if (val && !valid) emailError.classList.add('visible');
        else emailError.classList.remove('visible');
    });

    emailInput.addEventListener('input', () => {
        emailError.classList.remove('visible');
    });
    btnEnvoyer.addEventListener('click', () => {
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

        document.getElementById('contact-confirmation-text').innerHTML =
            `Votre message a bien été envoyé.<br>
             Myrtille vous répondra dans les plus brefs délais à <strong>${email}</strong>.`;

        document.getElementById('contact-confirmation').style.display = 'block';
        btnEnvoyer.textContent = 'Envoyé ✓';
        btnEnvoyer.disabled    = true;
    });

});
