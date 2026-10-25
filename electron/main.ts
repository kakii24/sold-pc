import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, db } from './database';
import {
  checkLicenseOnStartup,
  activateLicense,
  getMachineId,
  isLicenseActivated,
} from './license';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let dbInitialized = false;

function ensureDatabaseInitialized() {
  if (!dbInitialized) {
    initDB();
    dbInitialized = true;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'GestionStock',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
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
  const { activated } = checkLicenseOnStartup();
  if (activated) {
    ensureDatabaseInitialized();
  }
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

// License IPC Handlers
ipcMain.handle('license:status', () => {
  const status = checkLicenseOnStartup();
  if (status.activated) {
    ensureDatabaseInitialized();
  }
  return status;
});

ipcMain.handle('license:get-machine-id', () => {
  return getMachineId();
});

ipcMain.handle('license:activate', (_, key: string) => {
  const result = activateLicense(key);
  if (result.success) {
    ensureDatabaseInitialized();
  }
  return result;
});

// IPC Database Handlers (Guarded by License Activation)
ipcMain.handle('get-clients', () => {
  if (!isLicenseActivated()) return [];
  try {
    return db.prepare('SELECT * FROM clients ORDER BY id DESC').all();
  } catch (err: any) {
    console.error('Failed to get clients:', err);
    return [];
  }
});

ipcMain.handle('clients:search', (_, query) => {
  if (!isLicenseActivated()) return [];
  try {
    const searchTerm = `%${query}%`;
    return db.prepare('SELECT id, nom, nom_magasin, telephone, adresse, nif, nis, registre_numero, total_dette FROM clients WHERE nom LIKE ? OR nom_magasin LIKE ? OR telephone LIKE ? OR nif LIKE ? OR registre_numero LIKE ? LIMIT 50').all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  } catch (err: any) {
    console.error('Failed to search clients:', err);
    return [];
  }
});

ipcMain.handle('clients:create', async (_, clientData) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const stmt = db.prepare(`
      INSERT INTO clients (nom, nom_magasin, telephone, adresse, nif, nis, registre_numero, total_dette)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0.0)
    `);
    const info = stmt.run(
      clientData.nom, 
      clientData.nom_magasin, 
      clientData.telephone || '', 
      clientData.adresse || '',
      clientData.nif || '',
      clientData.nis || '',
      clientData.registre_numero || ''
    );
    const newClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
    return { success: true, client: newClient };
  } catch (err: any) {
    console.error('Failed to create client:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('clients:update', async (_, client) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const stmt = db.prepare(`
      UPDATE clients 
      SET nom = ?, nom_magasin = ?, telephone = ?, adresse = ?, nif = ?, nis = ?, registre_numero = ?
      WHERE id = ?
    `);
    stmt.run(
      client.nom,
      client.nom_magasin,
      client.telephone || '',
      client.adresse || '',
      client.nif || '',
      client.nis || '',
      client.registre_numero || '',
      client.id
    );
    const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id);
    return { success: true, client: updated };
  } catch (err: any) {
    console.error('Failed to update client:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('clients:get-sales', (_, clientId) => {
  if (!isLicenseActivated()) return [];
  try {
    const sales = db.prepare(`
      SELECT s.*, 
             (SELECT count(*) FROM sale_items WHERE sale_id = s.id) as item_count
      FROM sales s
      WHERE s.client_id = ?
      ORDER BY s.created_at DESC, s.id DESC
    `).all(clientId);
    return sales;
  } catch (err: any) {
    console.error('Failed to get client sales:', err);
    return [];
  }
});

ipcMain.handle('sales:get-details', (_, saleId) => {
  if (!isLicenseActivated()) return { sale: null, items: [] };
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    const items = db.prepare(`
      SELECT si.*, p.nom as product_nom, p.code_barre as product_code_barre
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
      ORDER BY si.id ASC
    `).all(saleId);
    return { sale, items };
  } catch (err: any) {
    console.error('Failed to get sale details:', err);
    return { sale: null, items: [] };
  }
});

ipcMain.handle('clients:get-ledger', (_, clientId) => {
  if (!isLicenseActivated()) return [];
  try {
    const entries = db.prepare(`
      SELECT l.*, s.total_ht as sale_total
      FROM client_debt_ledger l
      LEFT JOIN sales s ON l.sale_id = s.id
      WHERE l.client_id = ?
      ORDER BY l.date_operation DESC, l.id DESC
    `).all(clientId);
    return entries;
  } catch (err: any) {
    console.error('Failed to get client ledger:', err);
    return [];
  }
});

ipcMain.handle('clients:pay-debt', async (_, { clientId, montant }) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const transaction = db.transaction(() => {
      const client = db.prepare('SELECT id, nom, nom_magasin, total_dette FROM clients WHERE id = ?').get(clientId) as any;
      if (!client) {
        throw new Error('Client introuvable.');
      }

      const montantVers = Number(montant);
      if (isNaN(montantVers) || montantVers <= 0) {
        throw new Error('Montant invalide.');
      }

      const detteActuelle = Number(client.total_dette) || 0;
      if (detteActuelle <= 0) {
        throw new Error('Ce client n’a aucune dette en cours.');
      }

      const montantPaye = Math.min(detteActuelle, montantVers);
      const nouveauSolde = Math.max(0, detteActuelle - montantPaye);

      // 1. Update client total_dette
      db.prepare('UPDATE clients SET total_dette = ? WHERE id = ?').run(nouveauSolde, clientId);

      // 2. Record in ledger
      const ledgerStmt = db.prepare(`
        INSERT INTO client_debt_ledger (client_id, sale_id, type_operation, montant, solde_apres)
        VALUES (?, NULL, 'VERSEMENT_DETTE', ?, ?)
      `);
      ledgerStmt.run(clientId, montantPaye, nouveauSolde);

      const updatedClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
      return {
        success: true,
        client: updatedClient,
        montantPaye,
        nouveauSolde,
        aRendre: Math.max(0, montantVers - detteActuelle)
      };
    });

    return transaction();
  } catch (err: any) {
    console.error('Failed to process debt payment:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-products', () => {
  if (!isLicenseActivated()) return [];
  return db.prepare('SELECT * FROM products ORDER BY id DESC').all();
});

ipcMain.handle('products:search', (_, query) => {
  if (!isLicenseActivated()) return [];
  const searchTerm = `%${query}%`;
  return db.prepare('SELECT * FROM products WHERE nom LIKE ? OR code_barre = ? ORDER BY id DESC LIMIT 50').all(searchTerm, query);
});

ipcMain.handle('products:by-barcode', (_, code_barre) => {
  if (!isLicenseActivated()) return null;
  return db.prepare('SELECT * FROM products WHERE code_barre = ?').get(code_barre);
});

ipcMain.handle('products:create', (_, product) => {
  if (!isLicenseActivated()) throw new Error('Logiciel non activé.');
  const stmt = db.prepare(`
    INSERT INTO products (code_barre, nom, stock_actuel, seuil_alerte, prix_achat, prix_gros, prix_detail, date_expiration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    product.code_barre,
    product.nom,
    Number(product.stock_actuel) || 0,
    Number(product.seuil_alerte) || 5,
    Number(product.prix_achat) || 0,
    Number(product.prix_gros) || 0,
    Number(product.prix_detail) || 0,
    product.date_expiration || null
  );
  return db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
});

ipcMain.handle('products:update', (_, product) => {
  if (!isLicenseActivated()) throw new Error('Logiciel non activé.');
  const stmt = db.prepare(`
    UPDATE products 
    SET code_barre = ?, nom = ?, stock_actuel = ?, seuil_alerte = ?, prix_achat = ?, prix_gros = ?, prix_detail = ?, date_expiration = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(
    product.code_barre,
    product.nom,
    Number(product.stock_actuel),
    Number(product.seuil_alerte),
    Number(product.prix_achat),
    Number(product.prix_gros),
    Number(product.prix_detail),
    product.date_expiration || null,
    product.id
  );
  return db.prepare('SELECT * FROM products WHERE id = ?').get(product.id);
});

ipcMain.handle('products:delete', (_, id) => {
  if (!isLicenseActivated()) throw new Error('Logiciel non activé.');
  const stmt = db.prepare('DELETE FROM products WHERE id = ?');
  stmt.run(id);
  return { success: true };
});

ipcMain.handle('products:adjust-stock', (_, { id, delta }) => {
  if (!isLicenseActivated()) throw new Error('Logiciel non activé.');
  const stmt = db.prepare('UPDATE products SET stock_actuel = MAX(0, stock_actuel + ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(Number(delta), id);
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
});

ipcMain.handle('products:seed', () => {
  if (!isLicenseActivated()) return { seeded: false, count: 0 };
  const count = db.prepare('SELECT count(*) as count FROM products').get() as { count: number };
  if (count.count > 0) return { seeded: false, count: count.count };

  const insert = db.prepare(`
    INSERT INTO products (code_barre, nom, stock_actuel, seuil_alerte, prix_achat, prix_gros, prix_detail, date_expiration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleProducts = [
    ['613000100001', 'Huile Elio 5L', 45, 10, 650, 720, 750, '2027-06-15'],
    ['613000100002', 'Sucre Cevital 1kg', 120, 20, 90, 98, 105, '2027-12-31'],
    ['613000100003', 'Farine Sim 1kg', 80, 15, 60, 68, 75, '2026-10-25'],
    ['613000100004', 'Lait Candia 1L', 6, 12, 110, 125, 135, '2026-09-20'],
    ['613000100005', 'Café Famico 250g', 35, 10, 220, 245, 260, '2027-05-01'],
    ['613000100006', 'Pâtes Mama 500g', 95, 25, 45, 52, 60, '2027-08-10'],
    ['613000100007', 'Eau Minérale Lalla Khedidja 1.5L', 3, 15, 30, 36, 45, null],
    ['613000100008', 'Tomate Conserve Izmir 800g', 40, 10, 180, 210, 230, '2026-10-18'],
  ];

  const seedTx = db.transaction(() => {
    for (const p of sampleProducts) {
      insert.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
    }
    const clientCount = db.prepare('SELECT count(*) as count FROM clients').get() as { count: number };
    if (clientCount.count === 0) {
      const insertClient = db.prepare('INSERT INTO clients (nom, nom_magasin, adresse, total_dette) VALUES (?, ?, ?, ?)');
      insertClient.run('Ahmed Benali', 'Alimentation Générale El Baraka', 'Alger Centre', 15000);
      insertClient.run('Karim Mansouri', 'Supérette Les Oliviers', 'Kouba', 8500);
      insertClient.run('Samir Touati', 'Épicerie Samir', 'Bab El Oued', 0);
    }
    const supplierCount = db.prepare('SELECT count(*) as count FROM suppliers').get() as { count: number };
    if (supplierCount.count === 0) {
      const insertSupplier = db.prepare('INSERT INTO suppliers (nom, nom_societe, telephone, adresse, total_dette) VALUES (?, ?, ?, ?, ?)');
      insertSupplier.run('Mourad Khelifi', 'Cevital Agro Distribution', '0550 11 22 33', 'Zone Industrielle Rouiba, Alger', 45000);
      insertSupplier.run('Yacine Brahimi', 'Groupe SIM Algérie', '0561 44 55 66', 'Blida', 18000);
      insertSupplier.run('Farid Meziane', 'Centrale Laitière Candia', '0770 88 99 00', 'Birtouta, Alger', 0);
    }
  });
  seedTx();

  return { seeded: true, count: sampleProducts.length };
});

// Suppliers (Fournisseurs) IPC Handlers
ipcMain.handle('get-suppliers', () => {
  if (!isLicenseActivated()) return [];
  try {
    return db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all();
  } catch (err: any) {
    console.error('Failed to get suppliers:', err);
    return [];
  }
});

ipcMain.handle('suppliers:search', (_, query) => {
  if (!isLicenseActivated()) return [];
  try {
    const searchTerm = `%${query}%`;
    return db.prepare(
      'SELECT * FROM suppliers WHERE nom LIKE ? OR nom_societe LIKE ? OR telephone LIKE ? ORDER BY id DESC LIMIT 50'
    ).all(searchTerm, searchTerm, searchTerm);
  } catch (err: any) {
    console.error('Failed to search suppliers:', err);
    return [];
  }
});

ipcMain.handle('suppliers:create', (_, supplierData) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const initialDebt = Math.max(0, Number(supplierData.total_dette) || 0);
    const tx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO suppliers (nom, nom_societe, telephone, adresse, total_dette)
        VALUES (?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        supplierData.nom,
        supplierData.nom_societe || '',
        supplierData.telephone || '',
        supplierData.adresse || '',
        initialDebt
      );
      const supplierId = Number(info.lastInsertRowid);

      if (initialDebt > 0) {
        db.prepare(`
          INSERT INTO supplier_ledger (supplier_id, invoice_id, type_operation, montant, solde_apres, description)
          VALUES (?, NULL, 'FACTURE_ACHAT', ?, ?, 'Solde initial à l''ouverture du compte')
        `).run(supplierId, initialDebt, initialDebt);
      }

      const newSupplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      return { success: true, supplier: newSupplier };
    });
    return tx();
  } catch (err: any) {
    console.error('Failed to create supplier:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:update', (_, supplier) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const stmt = db.prepare(`
      UPDATE suppliers
      SET nom = ?, nom_societe = ?, telephone = ?, adresse = ?
      WHERE id = ?
    `);
    stmt.run(
      supplier.nom,
      supplier.nom_societe || '',
      supplier.telephone || '',
      supplier.adresse || '',
      supplier.id
    );
    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier.id);
    return { success: true, supplier: updated };
  } catch (err: any) {
    console.error('Failed to update supplier:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:delete', (_, id) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete supplier:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:get-invoices', (_, supplierId) => {
  if (!isLicenseActivated()) return [];
  try {
    return db.prepare(`
      SELECT * FROM supplier_invoices
      WHERE supplier_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(supplierId);
  } catch (err: any) {
    console.error('Failed to get supplier invoices:', err);
    return [];
  }
});

ipcMain.handle('suppliers:get-ledger', (_, supplierId) => {
  if (!isLicenseActivated()) return [];
  try {
    return db.prepare(`
      SELECT l.*, i.reference_facture, i.montant_total as invoice_total
      FROM supplier_ledger l
      LEFT JOIN supplier_invoices i ON l.invoice_id = i.id
      WHERE l.supplier_id = ?
      ORDER BY l.date_operation DESC, l.id DESC
    `).all(supplierId);
  } catch (err: any) {
    console.error('Failed to get supplier ledger:', err);
    return [];
  }
});

ipcMain.handle('suppliers:create-invoice', (_, payload) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const { supplierId, reference_facture, description, montant_total, montant_paye } = payload;
    const total = Math.max(0, Number(montant_total) || 0);
    const paye = Math.max(0, Number(montant_paye) || 0);
    const detteGeneree = Math.max(0, total - paye);

    if (total <= 0) {
      return { success: false, error: 'Le montant total de la facture doit être supérieur à 0.' };
    }

    const tx = db.transaction(() => {
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as any;
      if (!supplier) {
        throw new Error('Fournisseur introuvable.');
      }

      const detteActuelle = Number(supplier.total_dette) || 0;
      const nouveauSolde = detteActuelle + detteGeneree;

      const invStmt = db.prepare(`
        INSERT INTO supplier_invoices (supplier_id, reference_facture, description, montant_total, montant_paye, dette_generee)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const invInfo = invStmt.run(
        supplierId,
        reference_facture || '',
        description || 'Approvisionnement / Facture achat',
        total,
        paye,
        detteGeneree
      );
      const invoiceId = Number(invInfo.lastInsertRowid);

      if (detteGeneree > 0) {
        db.prepare('UPDATE suppliers SET total_dette = ? WHERE id = ?').run(nouveauSolde, supplierId);
      }

      db.prepare(`
        INSERT INTO supplier_ledger (supplier_id, invoice_id, type_operation, montant, solde_apres, description)
        VALUES (?, ?, 'FACTURE_ACHAT', ?, ?, ?)
      `).run(
        supplierId,
        invoiceId,
        detteGeneree > 0 ? detteGeneree : total,
        nouveauSolde,
        description || (reference_facture ? `Facture ${reference_facture}` : 'Facture fournisseur')
      );

      const updatedSupplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      return {
        success: true,
        supplier: updatedSupplier,
        invoiceId,
        detteGeneree,
        nouveauSolde,
      };
    });

    return tx();
  } catch (err: any) {
    console.error('Failed to create supplier invoice:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:pay-debt', (_, { supplierId, montant, description }) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const tx = db.transaction(() => {
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as any;
      if (!supplier) {
        throw new Error('Fournisseur introuvable.');
      }

      const montantVers = Number(montant);
      if (isNaN(montantVers) || montantVers <= 0) {
        throw new Error('Montant de règlement invalide.');
      }

      const detteActuelle = Number(supplier.total_dette) || 0;
      if (detteActuelle <= 0) {
        throw new Error('Aucune dette en cours envers ce fournisseur.');
      }

      const montantPaye = Math.min(detteActuelle, montantVers);
      const nouveauSolde = Math.max(0, detteActuelle - montantPaye);

      db.prepare('UPDATE suppliers SET total_dette = ? WHERE id = ?').run(nouveauSolde, supplierId);

      db.prepare(`
        INSERT INTO supplier_ledger (supplier_id, invoice_id, type_operation, montant, solde_apres, description)
        VALUES (?, NULL, 'REGLEMENT_FOURNISSEUR', ?, ?, ?)
      `).run(
        supplierId,
        montantPaye,
        nouveauSolde,
        description || 'Règlement dette fournisseur'
      );

      const updatedSupplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      return {
        success: true,
        supplier: updatedSupplier,
        montantPaye,
        nouveauSolde,
      };
    });

    return tx();
  } catch (err: any) {
    console.error('Failed to pay supplier debt:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('sales:create-wholesale', (_, payload) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const { clientId, items, totalHt, montantVerse } = payload;
    const totalBon = Number(totalHt) || 0;
    const verse = Number(montantVerse) || 0;
    const detteVente = Math.max(0, totalBon - verse);

    const transaction = db.transaction(() => {
      const existingClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as any;
      if (!existingClient) {
        throw new Error('Client introuvable.');
      }

      const ancienCredit = Number(existingClient.total_dette) || 0;
      const nouveauSoldeTotal = ancienCredit + detteVente;

      // 1. Insert into sales
      const saleStmt = db.prepare(`
        INSERT INTO sales (type_vente, client_id, total_ht, montant_verse, dette_generee) 
        VALUES ('GROS', ?, ?, ?, ?)
      `);
      const saleInfo = saleStmt.run(clientId, totalBon, verse, detteVente);
      const saleId = Number(saleInfo.lastInsertRowid);

      // 2. Insert items and update stock
      const itemStmt = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantite, prix_achat_unitaire, prix_vente_unitaire, total_ligne)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const stockStmt = db.prepare('UPDATE products SET stock_actuel = MAX(0, stock_actuel - ?) WHERE id = ?');

      for (const item of items) {
        itemStmt.run(saleId, item.productId, item.quantite, item.prix_achat, item.prix_vente, item.total_ligne);
        stockStmt.run(item.quantite, item.productId);
      }

      // 3. Update debt if needed
      if (detteVente > 0) {
        const clientUpdateStmt = db.prepare('UPDATE clients SET total_dette = ? WHERE id = ?');
        clientUpdateStmt.run(nouveauSoldeTotal, clientId);
        
        const ledgerStmt = db.prepare(`
          INSERT INTO client_debt_ledger (client_id, sale_id, type_operation, montant, solde_apres)
          VALUES (?, ?, 'VENTE_CREDIT', ?, ?)
        `);
        ledgerStmt.run(clientId, saleId, detteVente, nouveauSoldeTotal);
      }

      const updatedClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
      
      return {
        success: true,
        saleId,
        ancienCredit,
        detteGeneree: detteVente,
        nouveauSoldeTotal,
        client: updatedClient,
      };
    });

    return transaction();
  } catch (err: any) {
    console.error('Failed to create wholesale sale:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('sales:create-retail', (_, payload) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const { items, totalHt, montantVerse } = payload;
    
    if (!items || !items.length) {
      return { success: false, error: 'Le panier est vide.' };
    }

    const transaction = db.transaction(() => {
      // 1. Insert into sales: type_vente = 'DETAIL', client_id = NULL, dette_generee = 0.0
      const saleStmt = db.prepare(`
        INSERT INTO sales (type_vente, client_id, total_ht, montant_verse, dette_generee) 
        VALUES ('DETAIL', NULL, ?, ?, 0.0)
      `);
      const saleInfo = saleStmt.run(totalHt, montantVerse);
      const saleId = saleInfo.lastInsertRowid;

      // 2. Insert items and update stock atomically
      const itemStmt = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantite, prix_achat_unitaire, prix_vente_unitaire, total_ligne)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const stockStmt = db.prepare('UPDATE products SET stock_actuel = MAX(0, stock_actuel - ?) WHERE id = ?');

      for (const item of items) {
        itemStmt.run(saleId, item.productId, item.quantite, item.prix_achat, item.prix_vente, item.total_ligne);
        stockStmt.run(item.quantite, item.productId);
      }

      return { success: true, saleId };
    });

    return transaction();
  } catch (err: any) {
    console.error('Failed to create retail sale:', err);
    return { success: false, error: err.message };
  }
});

// Thermal Printing IPC Handlers
ipcMain.handle('print:receipt', async (event, options?: { silent?: boolean; printerName?: string }) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      throw new Error('Fenêtre principale introuvable pour l’impression.');
    }

    const printOptions: Electron.WebContentsPrintOptions = {
      silent: options?.silent ?? false,
      printBackground: true,
      margins: {
        marginType: 'none',
      },
      color: false, // Monochromatic thermal output
    };

    if (options?.printerName) {
      printOptions.deviceName = options.printerName;
    }

    return new Promise((resolve) => {
      win.webContents.print(printOptions, (success, failureReason) => {
        if (!success) {
          console.warn('Impression annulée ou échouée:', failureReason);
        }
        resolve({ success, error: failureReason || undefined });
      });
    });
  } catch (err: any) {
    console.error('Erreur impression ticket:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('print:get-printers', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return [];
    return await win.webContents.getPrintersAsync();
  } catch (err: any) {
    console.error('Erreur récupération imprimantes:', err);
    return [];
  }
});




// Charges IPC Handlers (Guarded by License Activation)
ipcMain.handle('charges:get-all', () => {
  if (!isLicenseActivated()) return [];
  try {
    return db.prepare('SELECT * FROM charges ORDER BY date_charge DESC, id DESC').all();
  } catch (err: any) {
    console.error('Failed to get charges:', err);
    return [];
  }
});

ipcMain.handle('charges:create', (_, charge: { titre: string; montant: number; categorie?: string; notes?: string; date_charge?: string }) => {
  if (!isLicenseActivated()) throw new Error('Logiciel non activé.');
  try {
    const stmt = db.prepare(`
      INSERT INTO charges (titre, montant, categorie, notes, date_charge)
      VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    const info = stmt.run(
      charge.titre?.trim() || 'Charge',
      Number(charge.montant) || 0,
      charge.categorie?.trim() || 'Autre',
      charge.notes?.trim() || null,
      charge.date_charge || null
    );
    const created = db.prepare('SELECT * FROM charges WHERE id = ?').get(info.lastInsertRowid);
    return { success: true, charge: created };
  } catch (err: any) {
    console.error('Failed to create charge:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('charges:update', (_, charge: { id: number; titre: string; montant: number; categorie?: string; notes?: string; date_charge?: string }) => {
  if (!isLicenseActivated()) throw new Error('Logiciel non activé.');
  try {
    const stmt = db.prepare(`
      UPDATE charges
      SET titre = ?, montant = ?, categorie = ?, notes = ?, date_charge = ?
      WHERE id = ?
    `);
    stmt.run(
      charge.titre?.trim() || 'Charge',
      Number(charge.montant) || 0,
      charge.categorie?.trim() || 'Autre',
      charge.notes?.trim() || null,
      charge.date_charge || new Date().toISOString(),
      charge.id
    );
    const updated = db.prepare('SELECT * FROM charges WHERE id = ?').get(charge.id);
    return { success: true, charge: updated };
  } catch (err: any) {
    console.error('Failed to update charge:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('charges:delete', (_, id: number) => {
  if (!isLicenseActivated()) throw new Error('Logiciel non activé.');
  try {
    db.prepare('DELETE FROM charges WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete charge:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('charges:get-summary', () => {
  if (!isLicenseActivated()) {
    return { totalCumule: 0, totalCeMois: 0, totalAujourdhui: 0, count: 0, byCategory: [] };
  }
  try {
    const totalRow = db.prepare('SELECT COALESCE(SUM(montant), 0) as total, COUNT(*) as count FROM charges').get() as any;
    const monthRow = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) as total 
      FROM charges 
      WHERE strftime('%Y-%m', date_charge) = strftime('%Y-%m', 'now', 'localtime')
    `).get() as any;
    const todayRow = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) as total 
      FROM charges 
      WHERE date(date_charge) = date('now', 'localtime')
    `).get() as any;
    const byCategory = db.prepare(`
      SELECT categorie, COALESCE(SUM(montant), 0) as total, COUNT(*) as count 
      FROM charges 
      GROUP BY categorie 
      ORDER BY total DESC
    `).all();

    return {
      totalCumule: Number(totalRow?.total) || 0,
      totalCeMois: Number(monthRow?.total) || 0,
      totalAujourdhui: Number(todayRow?.total) || 0,
      count: Number(totalRow?.count) || 0,
      byCategory: byCategory || [],
    };
  } catch (err: any) {
    console.error('Failed to get charges summary:', err);
    return { totalCumule: 0, totalCeMois: 0, totalAujourdhui: 0, count: 0, byCategory: [] };
  }
});

// Supplier Products IPC Handlers
ipcMain.handle('suppliers:get-products', (_, supplierId: number) => {
  if (!isLicenseActivated()) return [];
  try {
    return db.prepare(`
      SELECT * FROM supplier_products
      WHERE supplier_id = ?
      ORDER BY id DESC
    `).all(supplierId);
  } catch (err: any) {
    console.error('Failed to get supplier products:', err);
    return [];
  }
});

ipcMain.handle('suppliers:add-product', (_, productData: { supplier_id: number; nom: string; reference?: string; prix_achat: number; categorie?: string; notes?: string }) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const stmt = db.prepare(`
      INSERT INTO supplier_products (supplier_id, nom, reference, prix_achat, categorie, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      productData.supplier_id,
      productData.nom?.trim() || 'Produit',
      productData.reference?.trim() || null,
      Number(productData.prix_achat) || 0,
      productData.categorie?.trim() || null,
      productData.notes?.trim() || null
    );
    const created = db.prepare('SELECT * FROM supplier_products WHERE id = ?').get(info.lastInsertRowid);
    return { success: true, product: created };
  } catch (err: any) {
    console.error('Failed to add supplier product:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:update-product', (_, productData: { id: number; nom: string; reference?: string; prix_achat: number; categorie?: string; notes?: string }) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    const stmt = db.prepare(`
      UPDATE supplier_products
      SET nom = ?, reference = ?, prix_achat = ?, categorie = ?, notes = ?
      WHERE id = ?
    `);
    stmt.run(
      productData.nom?.trim() || 'Produit',
      productData.reference?.trim() || null,
      Number(productData.prix_achat) || 0,
      productData.categorie?.trim() || null,
      productData.notes?.trim() || null,
      productData.id
    );
    const updated = db.prepare('SELECT * FROM supplier_products WHERE id = ?').get(productData.id);
    return { success: true, product: updated };
  } catch (err: any) {
    console.error('Failed to update supplier product:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:delete-product', (_, id: number) => {
  if (!isLicenseActivated()) return { success: false, error: 'Logiciel non activé.' };
  try {
    db.prepare('DELETE FROM supplier_products WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete supplier product:', err);
    return { success: false, error: err.message };
  }
});
