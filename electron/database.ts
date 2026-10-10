import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'store_data.db');

// Ensure directory exists
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

// Seamless data migration if migrating from previous 'gestwo' folder
if (!fs.existsSync(dbPath)) {
  const legacyDbPath = path.join(app.getPath('appData'), 'gestwo', 'store_data.db');
  if (fs.existsSync(legacyDbPath)) {
    try {
      fs.copyFileSync(legacyDbPath, dbPath);
      console.log('Successfully migrated database from legacy path.');
    } catch (e) {
      console.warn('Could not auto-copy legacy database:', e);
    }
  }
}

export const db = new Database(dbPath);

// Configure SQLite to use WAL mode for maximum performance
db.pragma('journal_mode = WAL');

// Initialize database schema
export function initDB() {
  db.exec(`
    -- Clients
    CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        nom_magasin TEXT NOT NULL,
        telephone TEXT,
        adresse TEXT,
        total_dette REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_barre TEXT UNIQUE,
        nom TEXT NOT NULL,
        stock_actuel INTEGER DEFAULT 0,
        seuil_alerte INTEGER DEFAULT 5,
        prix_achat REAL NOT NULL,
        prix_gros REAL NOT NULL,
        prix_detail REAL NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(code_barre);

    -- Sales (Wholesale & Retail)
    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_vente TEXT CHECK(type_vente IN ('GROS', 'DETAIL')) NOT NULL,
        client_id INTEGER REFERENCES clients(id),
        total_ht REAL NOT NULL,
        montant_verse REAL NOT NULL,
        dette_generee REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sale Items
    CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantite INTEGER NOT NULL,
        prix_achat_unitaire REAL NOT NULL,
        prix_vente_unitaire REAL NOT NULL,
        total_ligne REAL NOT NULL
    );

    -- Debt Ledger
    CREATE TABLE IF NOT EXISTS client_debt_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        sale_id INTEGER REFERENCES sales(id),
        type_operation TEXT CHECK(type_operation IN ('VENTE_CREDIT', 'VERSEMENT_DETTE')) NOT NULL,
        montant REAL NOT NULL,
        solde_apres REAL NOT NULL,
        date_operation DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe migration: check if telephone column exists in clients
  try {
    const columns = db.pragma('table_info(clients)') as Array<{ name: string }>;
    const hasTelephone = columns.some((c) => c.name === 'telephone');
    if (!hasTelephone) {
      db.exec('ALTER TABLE clients ADD COLUMN telephone TEXT;');
    }
  } catch (err) {
    console.error('Migration error for clients.telephone:', err);
  }
}

// IPC Handlers implementation will be in main.ts, but we export db instance
