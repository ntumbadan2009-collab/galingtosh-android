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

Le workflow GitHub Actions `.github/workflows/android-apk.yml` vérifie TypeScript, valide la configuration Expo, génère le projet Android et compile un APK debug. Le fichier est publié comme artefact `galingtosh-release-apk` pour 14 jours après une compilation réussie.

Package Android : `com.danproduction.galingtosh`.


## Version 1.0.1 — réparation du parcours de production
Le client utilise les colonnes existantes `projects.title/user_id` et `media_assets.kind/source/storage_path/license`. La création appelle `create_studio_project` pour enregistrer le projet et son film ensemble. Le serveur Supabase doit disposer de la migration versionnée dans le dépôt moteur.

Ouvrir un projet restaure ses 100 derniers messages visibles et réinitialise les pièces jointes et la conversation précédentes. Le bouton **Scènes** présente le montage de travail. Les imports sont limités aux formats et aux 50 Mo autorisés par Storage, enregistrés dans `media_assets`, puis joints à l’agent par identifiant. Le suivi des productions reprend au lancement et affiche erreurs, avertissements et annulation.

La récupération de compte prend en charge les liens `galingtosh://auth/callback` et l’enregistrement d’un nouveau mot de passe. Le lien doit être autorisé dans la configuration Auth de Supabase et ouvert sur l’appareil qui a demandé la récupération.

Validation : `npm run typecheck`, export Metro/Hermes Android. Le workflow GitHub Actions construit l’APK ARM avec le JavaScript embarqué et le publie dans l’artefact **galingtosh-release-apk**. L’installation et le parcours connecté sur un téléphone restent une validation distincte de la compilation.
