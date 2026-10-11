# 🏪 GestionStock PRO — Logiciel de Point de Vente & Gestion de Stock (Gros & Détail)

![Electron](https://img.shields.io/badge/Electron-44.x-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite_WAL-better--sqlite3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

**GestionStock PRO** est une application de bureau Windows ultra-rapide et 100 % hors-ligne (offline-first) conçue pour les grossistes, supérettes et commerces de distribution en Algérie (DA).

---

## ✨ Fonctionnalités Principales

### 1. 🛒 Vente en Gros (`[F1]`)
- **Sélection & Création rapide de clients** avec suivi en temps réel du solde de dette (`total_dette`).
- **Catalogue interactif des produits disponibles** avec recherche instantanée par désignation ou code-barres (`[F9]`) et navigation complète au clavier.
- **Mode Versement Direct (Sans Achat) :** lorsqu'un client débiteur est sélectionné avec un panier vide, l'interface bascule automatiquement en mode règlement de créance.
- **Gestion du crédit :** calcul automatique du reste à payer, génération de dette et mise à jour atomique du grand livre client (`client_debt_ledger`).

### 2. ⚡ Vente au Détail — Caisse Rapide (`[F2]`)
- **Zéro friction :** encaissement immédiat pour les clients passagers au tarif `prix_detail`.
- **Support Douchette Code-Barres USB (HID Wedge) :** lecture continue avec retour sonore (Web Audio API) et protection contre les ruptures de stock.
- **Calculateur de monnaie rendu** avec boutons de coupures rapides (`200 DA`, `500 DA`, `1000 DA`, `2000 DA`, `Compte Exact`).

### 3. 📦 Gestion du Stock & Inventaire (`[F3]`)
- **Tableau de bord des stocks :** valorisation totale du stock (Prix d'achat vs Prix de vente), alertes de seuil critique et ruptures.
- **CRUD Produits complet :** double tarification (`prix_gros` / `prix_detail`), prix d'achat, seuil d'alerte et ajustement rapide (`+` / `-`).

### 4. 👥 Fiches Clients & Grand Livre des Crédits (`[F4]`)
- **Répertoire clients** avec recherche dynamique (Nom, Magasin, Téléphone) et indicateurs financiers.
- **Historique complet (Fiche Client) :** consultation détaillée de tous les bons d'achat passés et journal chronologique des opérations (`VENTE_CREDIT`, `VERSEMENT_DETTE`).
- **Encaissement de règlement direct** depuis la fiche client.

### 5. 🧾 Moteur d'Impression Thermique (58mm / 80mm)
- **Aperçu Ticket ultra-compact** optimisé pour les imprimantes thermiques de caisse (Xprinter, Epson, POS-80).
- **Mode impression directe ou avec prévisualisation** (`[Entrée]` pour imprimer, `[Échap]` pour fermer).

### 6. 🔒 Sécurité & Licence Matérielle (Node-Locked)
- Empreinte matérielle Windows (`Win32_ComputerSystemProduct`, `Win32_Processor`, `Win32_DiskDrive`) signée par `HMAC-SHA256`.
- Protection de tous les canaux IPC et de la base de données SQLite contre la copie non autorisée.

---

## ⌨️ Raccourcis Clavier Caisse

| Raccourci | Action |
| :--- | :--- |
| **`F1`** | Ouvrir le module **Vente en Gros** |
| **`F2`** | Ouvrir le module **Vente au Détail** |
| **`F3`** | Ouvrir le module **Gestion du Stock** |
| **`F4`** | Ouvrir le module **Fiches Clients & Crédits** |
| **`F6`** | Focus immédiat sur le lecteur **Code-Barres** |
| **`F9`** | Focus sur la recherche du **Catalogue Produits** |
| **`Ins`** | Créer un **Nouveau Client** |
| **`F12`** | **Valider la vente** ou enregistrer le versement |
| **`Échap`** | Fermer les fenêtres modales / Vider ou réinitialiser le focus |

---

## 🛠️ Installation & Compilation (Développement)

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer en mode développement (Vite + Electron HMR)
npm run dev

# 3. Générer l'installateur autonome Windows (.exe NSIS + dossier portable)
npm run build
```

Les fichiers de distribution autonomes sont générés dans `dist-app/` :
- `dist-app/GestionStock-Setup-1.0.0.exe` (Installateur Windows 64-bit autonome)
- `dist-app/win-unpacked/` (Version portable prête pour clé USB)
