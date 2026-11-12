# Galingtosh Android

Application Android native (Expo / React Native / TypeScript), interface sombre noire et violette conçue à partir de la maquette mobile Galingtosh.

## Fonctionnalités intégrées

- Studio conversationnel relié à la fonction Supabase Edge Function `chat-agent` (contrat : `message`, `conversation_id`, `project_id`, `attachments`).
- Création et lecture des projets via la table existante `projects`.
- Authentification Supabase par e-mail/mot de passe, inscription, récupération de mot de passe et OAuth Google.
- Deep link OAuth : `galingtosh://auth/callback`.
- Pièces jointes image, vidéo et audio envoyées dans le bucket privé `user-uploads`, sous le dossier de l'utilisateur.
- Lecture du catalogue commun `media_assets` (lecture seule, respect des licences).
- Lecture des documents Film JSON versionnés dans `films.data`.
- Demande de rendu par la fonction Supabase `request-render` avec `{ project_id }`.
- Suivi de `render_jobs`, progression, erreurs et avertissements.
- Téléchargement MP4 via URL signée dans le bucket `renders`.
- Vérification de disponibilité du moteur Render via `GET https://galingtosh-engine.onrender.com/health`.

## Architecture et sécurité

- Supabase Auth : identité et sessions.
- Supabase PostgreSQL : projets, conversations, Film JSON et tâches.
- Supabase Storage : médias privés et fichiers rendus.
- Edge Functions : orchestration de l'agent et mise en file du rendu.
- Render + Python/FastAPI + FFmpeg : assemblage audiovisuel déterministe.
- L'application mobile ne contient **aucune** clé `service_role` ni `ENGINE_SHARED_SECRET`.
- Aucun modèle de génération d'images ou de vidéos n'est utilisé. Galingtosh travaille avec les médias fournis ou ceux du catalogue, puis les assemble avec FFmpeg.

## Configuration

Copier `.env.example` vers `.env` et renseigner la clé publique **anon/publishable** du projet Supabase :

```env
EXPO_PUBLIC_SUPABASE_URL=https://lmlwekcytivszlszmfvy.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Ne jamais mettre une clé `service_role` ou le secret du moteur dans l'application.

Dans Supabase Auth, activer le fournisseur Google et autoriser le redirect URI `galingtosh://auth/callback`. Les fonctions `chat-agent` et `request-render`, le bucket `user-uploads` et le bucket `renders` doivent exister avec leurs politiques prévues.

## Développement

```bash
npm install
npx expo start
``

## APK Android

Le workflow GitHub Actions `.github/workflows/android-apk.yml` vérifie TypeScript, valide la configuration Expo, génère le projet Android et compile un APK debug. Le fichier est publié comme artefact `galingtosh-debug-apk` pour 14 jours après une compilation réussie.

Package Android : `com.danproduction.galingtosh`.
