# Myrtille_Raverdy_Sage_femme_Website-

Myrtille Raverdy — Site web de sage-femme indépendante
Site web professionnel réalisé pour une sage-femme indépendante à Lausanne (Suisse), avec un système de réservation de rendez-vous connecté à Google Agenda.

Voir le site en ligne: 

# Aperçu du projet

Ce projet a été développé de A à Z, du design à l'intégration backend, pour répondre aux besoins concrets d'une professionnelle de santé indépendante :
- Présenter ses services et son parcours
- Permettre aux patients de réserver une consultation en ligne
- Automatiser les confirmations de rendez-vous par email
- Synchroniser les réservations directement dans Google Agenda

## Données et confidentialité

Ce site ne collecte aucune donnée médicale.

Toutefois, certaines données personnelles (nom, email, créneau de rendez-vous) peuvent être traitées dans le cadre du système de réservation.

Ces données sont utilisées uniquement pour :
- la gestion des rendez-vous
- l’envoi de confirmations

Le traitement repose sur des services tiers :
- Google Agenda (gestion des événements)
- Google Apps Script (automatisation)

Aucune donnée n’est utilisée à des fins commerciales.

## Fonctionnalités

Système de réservation

Calendrier interactif avec navigation par mois, créneaux générés dynamiquement toutes les 30 minutes (9h00 – 18h00), détection automatique des conflits de créneaux en lisant les événements Google Agenda en temps réel. 

Gestion du buffer de 30 minutes avant/après pour les visites à domicile
Prise en charge des consultations standard (1h) et premières consultations (1h30)
Blocage automatique des week-ends et jours fériés vaudois 2026
Blocage des créneaux déjà passés dans la journée en cours
Affichage "Aucune disponibilité" si la journée est complète

## Automatisation Google Workspace

Création automatique d'un événement dans Google Agenda à chaque réservation
Deux couleurs distinctes dans l'agenda : 🟦 Cabinet / 🟥 Domicile
Email de confirmation envoyé automatiquement au patient
Email de notification envoyé à la sage-femme
Intégration via Google Apps Script (sans serveur dédié)

# Pages

Accueil — présentation des services, parcours, sections suivi prénatal et postnatal
Rendez-vous — calendrier de réservation avec formulaire complet
Contact — formulaire de contact avec validation
Mentions légales - 

# Design

Design néomorphique avec palette rose/saumon cohérente
Police personnalisée locale (Unageo)
Animations au scroll via IntersectionObserver
Entièrement responsive (mobile, tablette, desktop)
