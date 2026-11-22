# Galingtosh Web Studio

Version web de Galingtosh utilisant **le même Supabase** que l'application Android. Les données sont réelles et protégées par les politiques RLS existantes, sans backend parallèle.

## Démarrage

```sh
cd web
cp .env.example .env
npm install
npm run build
npm run dev
```

Configurer `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` (clé **publique** Supabase uniquement). Ne jamais mettre de clé `service_role` dans l'application web.

## Déploiement

Importer le dépôt dans Vercel, régler **Root Directory** sur `web`, build `npm run build`, output `dist`. Définir les deux variables `VITE_*`. Autoriser l'URL de production dans les URL de redirection Supabase Auth. Tous les accès passent par la session de l'utilisateur et les fonctions Edge protégées.

## Fonctionnalités

Connexion / création de compte, studio conversationnel, propositions créatives, validation et contrôle des missions, journal des tâches, projets versionnés, scènes, médias et rendus MP4 à URL signée. Aucun exemple fictif ou vidéo générative n'est injecté dans les données.

Les voix, rendus et médias sont produits par le backend Galingtosh Engine existant. La web app ne lance pas de second moteur, n'ajoute pas de clés privées et ne prétend pas qu'un rendu a réussi avant retour `status=done`.
