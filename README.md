# Galingtosh Android

Application mobile React Native / Expo du studio audiovisuel intelligent Galingtosh.

## Stack
- Expo SDK 58, React Native et TypeScript
- Supabase Auth, Database, Storage et Realtime
- Supabase Edge Functions pour l'agent IA et les demandes de rendu
- Expo Video pour la lecture native
- GitHub Actions pour la compilation APK Android

## Configuration
1. Copier `.env.example` vers `.env`.
2. Renseigner l'URL Supabase et la clé publishable.
3. Installer Node.js 22.13+ puis exécuter `npm install`.
4. Lancer `npx expo start`.

Google OAuth est déjà prévu dans l'application. Il faudra activer Google dans Supabase Auth, configurer les identifiants OAuth et autoriser le callback `galingtosh://auth/callback`. Aucun changement d'architecture mobile ne sera nécessaire pour activer le fournisseur.

## APK
Le workflow **Android APK** valide TypeScript, génère le projet Android natif et compile un APK debug. Le fichier est publié comme artefact GitHub Actions. La signature release et la publication Google Play seront configurées dans une phase ultérieure.

## Sécurité
Seule la clé Supabase publishable est utilisée côté mobile. Ne jamais ajouter de clé service_role, de secret Vault, de clé de fournisseur IA ou de secret du moteur Render dans l'application.
