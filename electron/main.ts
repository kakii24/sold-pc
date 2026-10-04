import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, db } from './database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  initDB();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Database Handlers
ipcMain.handle('get-clients', () => {
  return db.prepare('SELECT * FROM clients').all();
});

ipcMain.handle('clients:search', (_, query) => {
  const searchTerm = `%${query}%`;
  return db.prepare('SELECT id, nom, nom_magasin, total_dette FROM clients WHERE nom LIKE ? OR nom_magasin LIKE ? LIMIT 50').all(searchTerm, searchTerm);
});

ipcMain.handle('clients:create', (_, client) => {
  const stmt = db.prepare('INSERT INTO clients (nom, nom_magasin, adresse) VALUES (?, ?, ?)');
  const info = stmt.run(client.nom, client.nom_magasin, client.adresse || '');
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
});

ipcMain.handle('get-products', () => {
  return db.prepare('SELECT * FROM products').all();
});

ipcMain.handle('products:search', (_, query) => {
  const searchTerm = `%${query}%`;
  return db.prepare('SELECT * FROM products WHERE nom LIKE ? OR code_barre = ? LIMIT 50').all(searchTerm, query);
});

ipcMain.handle('products:by-barcode', (_, code_barre) => {
  return db.prepare('SELECT * FROM products WHERE code_barre = ?').get(code_barre);
});

ipcMain.handle('sales:create-wholesale', (_, payload) => {
  const { clientId, items, totalHt, montantVerse, detteGeneree } = payload;
  
  const transaction = db.transaction(() => {
    // 1. Insert into sales
    const saleStmt = db.prepare(`
      INSERT INTO sales (type_vente, client_id, total_ht, montant_verse, dette_generee) 
      VALUES ('GROS', ?, ?, ?, ?)
    `);
    const saleInfo = saleStmt.run(clientId, totalHt, montantVerse, detteGeneree);
    const saleId = saleInfo.lastInsertRowid;

    // 2. Insert items and update stock
    const itemStmt = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, quantite, prix_achat_unitaire, prix_vente_unitaire, total_ligne)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const stockStmt = db.prepare('UPDATE products SET stock_actuel = stock_actuel - ? WHERE id = ?');

    for (const item of items) {
      itemStmt.run(saleId, item.productId, item.quantite, item.prix_achat, item.prix_vente, item.total_ligne);
      stockStmt.run(item.quantite, item.productId);
    }

    // 3. Update debt if needed
    if (detteGeneree > 0) {
      const clientUpdateStmt = db.prepare('UPDATE clients SET total_dette = total_dette + ? WHERE id = ?');
      clientUpdateStmt.run(detteGeneree, clientId);
      
      const currentClient = db.prepare('SELECT total_dette FROM clients WHERE id = ?').get(clientId) as any;
      
      const ledgerStmt = db.prepare(`
        INSERT INTO client_debt_ledger (client_id, sale_id, type_operation, montant, solde_apres)
        VALUES (?, ?, 'VENTE_CREDIT', ?, ?)
      `);
      ledgerStmt.run(clientId, saleId, detteGeneree, currentClient.total_dette);
    }
    
    return { success: true, saleId };
  });

  return transaction();
});

