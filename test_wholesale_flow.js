import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'store_data_test.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// 1. Initialize schema
db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL, nom_magasin TEXT NOT NULL, adresse TEXT, total_dette REAL DEFAULT 0.0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT, code_barre TEXT UNIQUE, nom TEXT NOT NULL, stock_actuel INTEGER DEFAULT 0, seuil_alerte INTEGER DEFAULT 5, prix_achat REAL NOT NULL, prix_gros REAL NOT NULL, prix_detail REAL NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT, type_vente TEXT CHECK(type_vente IN ('GROS', 'DETAIL')) NOT NULL, client_id INTEGER REFERENCES clients(id), total_ht REAL NOT NULL, montant_verse REAL NOT NULL, dette_generee REAL DEFAULT 0.0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), quantite INTEGER NOT NULL, prix_achat_unitaire REAL NOT NULL, prix_vente_unitaire REAL NOT NULL, total_ligne REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS client_debt_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id), sale_id INTEGER REFERENCES sales(id), type_operation TEXT CHECK(type_operation IN ('VENTE_CREDIT', 'VERSEMENT_DETTE')) NOT NULL, montant REAL NOT NULL, solde_apres REAL NOT NULL, date_operation DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Clear tables for clean state
db.exec('DELETE FROM sale_items; DELETE FROM sales; DELETE FROM client_debt_ledger; DELETE FROM products; DELETE FROM clients;');

// 2. Setup initial test data
const insertProduct = db.prepare('INSERT INTO products (code_barre, nom, stock_actuel, prix_achat, prix_gros, prix_detail) VALUES (?, ?, ?, ?, ?, ?)');
const prodInfo = insertProduct.run('123456789', 'Produit Test', 50, 1000, 1400, 1600);
const productId = prodInfo.lastInsertRowid;

const insertClient = db.prepare('INSERT INTO clients (nom, nom_magasin, total_dette) VALUES (?, ?, ?)');
const clientInfo = insertClient.run('Client Test', 'Magasin Test', 5000);
const clientId = clientInfo.lastInsertRowid;

// 3. Simulate the exact IPC handler logic for Wholesale sale
const payload = {
  clientId,
  items: [{
    productId,
    quantite: 10,
    prix_achat: 1000,
    prix_vente: 1400,
    total_ligne: 14000
  }],
  totalHt: 14000,
  montantVerse: 10000,
  detteGeneree: 4000
};

console.log('--- EXECUTING TRANSACTION ---');
const transaction = db.transaction(() => {
  const saleStmt = db.prepare(`
    INSERT INTO sales (type_vente, client_id, total_ht, montant_verse, dette_generee) 
    VALUES ('GROS', ?, ?, ?, ?)
  `);
  const saleInfo = saleStmt.run(payload.clientId, payload.totalHt, payload.montantVerse, payload.detteGeneree);
  const saleId = saleInfo.lastInsertRowid;

  const itemStmt = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, quantite, prix_achat_unitaire, prix_vente_unitaire, total_ligne)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const stockStmt = db.prepare('UPDATE products SET stock_actuel = stock_actuel - ? WHERE id = ?');

  for (const item of payload.items) {
    itemStmt.run(saleId, item.productId, item.quantite, item.prix_achat, item.prix_vente, item.total_ligne);
    stockStmt.run(item.quantite, item.productId);
  }

  if (payload.detteGeneree > 0) {
    const clientUpdateStmt = db.prepare('UPDATE clients SET total_dette = total_dette + ? WHERE id = ?');
    clientUpdateStmt.run(payload.detteGeneree, payload.clientId);
    
    const currentClient = db.prepare('SELECT total_dette FROM clients WHERE id = ?').get(payload.clientId);
    
    const ledgerStmt = db.prepare(`
      INSERT INTO client_debt_ledger (client_id, sale_id, type_operation, montant, solde_apres)
      VALUES (?, ?, 'VENTE_CREDIT', ?, ?)
    `);
    ledgerStmt.run(payload.clientId, saleId, payload.detteGeneree, currentClient.total_dette);
  }
  return saleId;
});

const saleId = transaction();
console.log('Sale successful, ID:', saleId);

// 4. Run Assertions
console.log('\\n--- RUNNING ASSERTIONS ---');
const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
if (sale.total_ht === 14000 && sale.montant_verse === 10000 && sale.dette_generee === 4000) {
  console.log('✅ Sales row exists and matches amounts.');
} else {
  console.error('❌ Sales row mismatch:', sale);
}

const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
if (product.stock_actuel === 40) {
  console.log('✅ Product stock deducted correctly (50 - 10 = 40).');
} else {
  console.error('❌ Product stock mismatch:', product.stock_actuel);
}

const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
if (client.total_dette === 9000) {
  console.log('✅ Client debt accumulated correctly (5000 + 4000 = 9000).');
} else {
  console.error('❌ Client debt mismatch:', client.total_dette);
}

const ledger = db.prepare('SELECT * FROM client_debt_ledger WHERE sale_id = ?').get(saleId);
if (ledger && ledger.montant === 4000 && ledger.solde_apres === 9000) {
  console.log('✅ Ledger entry created with correct balance.');
} else {
  console.error('❌ Ledger entry mismatch:', ledger);
}

// Check what happens if stock goes negative (simulate transaction fail or just allow it based on schema)
console.log('\\n--- TESTS COMPLETE ---');
