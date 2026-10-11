# Changelog

All notable changes to **GestionStock PRO** are documented in this file.

## [1.0.0] - 2026-10-11

### Added
- **Wholesale POS (`Vente en Gros` [F1]):** Live product catalog search (`[F9]`), barcode scanning (`[F6]`), inline cart price/quantity editing, and automatic credit calculation.
- **Direct Debt Repayment Mode:** Seamless debt settlement flow when selecting an indebted client with an empty cart.
- **Retail POS (`Vente au Détail` [F2]):** Walk-in customer checkout with strict cash payment enforcement, audio feedback, and quick cash denomination buttons.
- **Inventory Management (`Gestion du Stock` [F3]):** Full product CRUD, dual pricing (`prix_gros` & `prix_detail`), stock valuation metrics, and low-stock badges.
- **Clients & Credit Ledger (`Fiches Clients & Crédits` [F4]):** Client directory, detailed purchase history modal, chronological debt ledger, and direct debt collection.
- **Thermal Receipt Engine:** Minimal 58mm/80mm thermal receipt preview and printing modal (`ReceiptPreviewModal`).
- **Node-Locked Licensing System:** Windows hardware fingerprint verification (`SHA-256` / `HMAC`) and `ActivationLockScreen` gate.
- **Standalone Packaging:** Configured `electron-builder` NSIS installer and portable bundle with embedded MSVC runtime DLLs.

### Fixed
- Resolved `nouveauSoldeTotal` scope reference error during wholesale checkout and receipt preview.
- Guarded global keyboard shortcuts when modal dialogs are open.
