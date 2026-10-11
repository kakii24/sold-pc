# 📦 Guide de Déploiement Client — GestionStock PRO

Ce document détaille la procédure d'installation de **GestionStock PRO** sur les ordinateurs de caisse clients sous Windows 10/11 (64-bit) ne disposant d'aucun outil de développement (ni Node.js, ni Git, ni compilateur C++).

---

## 1. Fichiers à Copier sur Clé USB

Copiez uniquement le fichier d'installation autonome généré dans `dist-app/` :
- **`dist-app/GestionStock-Setup-1.0.0.exe`** *(Installateur NSIS recommandé)*
- Ou le dossier **`dist-app/win-unpacked/`** *(Version portable sans installation)*

> ⚠️ **Sécurité :** Ne copiez jamais le dossier `scripts/` sur le poste client.

---

## 2. Installation et Activation sur le Poste Client

1. Branchez la clé USB sur le PC du client et exécutez **`GestionStock-Setup-1.0.0.exe`**.
2. Suivez l'assistant d'installation (un raccourci **GestionStock PRO** est créé sur le Bureau).
3. Au premier lancement, l'écran **« Activation Requise »** s'affiche.
4. Saisissez le mot de passe d'activation administrateur et cliquez sur **`[Activer le Logiciel]`**.
5. L'application se déverrouille immédiatement et enregistre un jeton matériel signé dans `%APPDATA%\GestionStock\license.key`.

---

## 3. Emplacement de la Base de Données & Sauvegardes

La base de données SQLite (en mode `WAL` haute performance) est stockée dans le répertoire utilisateur Windows :

```text
%APPDATA%\GestionStock\store_data.db
```

### Sauvegarde (Backup)
Pour sauvegarder l'intégralité des produits, ventes, clients et créances, copiez les fichiers suivants sur un support externe :
- `store_data.db`
- `store_data.db-wal`
- `store_data.db-shm`
