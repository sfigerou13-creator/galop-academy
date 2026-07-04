# Galop Academy 🐴

Application web mobile-first pour réviser les galops FFE (1 à 7) : cours, QCM, hub, outils (anatomie, selle, sabot…), conseils, articles, clubs et réservations.

## Stack
- Front : HTML/CSS/JS (aucun framework), une seule page `index.html`
- Back : **Supabase** (Auth + Postgres) — voir `supabase-schema.sql`
- Email : fonction serverless Vercel `api/send-email.js` (via Resend)
- Hébergement : **Vercel** (statique + /api)

## Configuration
1. **Supabase** : créer un projet, exécuter `supabase-schema.sql` dans SQL Editor,
   puis renseigner `SUPABASE_URL` et `SUPABASE_ANON` en haut du bloc script dans `index.html`.
   (Auth > Providers : activer Email ; désactiver la confirmation d'email pour un usage simple.)
2. **Resend** (emails) : créer une clé API, l'ajouter dans Vercel > Settings >
   Environment Variables : `RESEND_API_KEY` (et `MAIL_FROM`).
3. **Vercel** : importer ce dépôt → déploiement automatique à chaque push.

## Déploiement
Push sur `main` → Vercel déploie automatiquement.
