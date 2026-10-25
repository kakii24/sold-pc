import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getClients: () => ipcRenderer.invoke('get-clients'),
  searchClients: (query: string) => ipcRenderer.invoke('clients:search', query),
  createClient: (client: any) => ipcRenderer.invoke('clients:create', client),
  updateClient: (client: any) => ipcRenderer.invoke('clients:update', client),
  getClientSales: (clientId: number) => ipcRenderer.invoke('clients:get-sales', clientId),
  getSaleDetails: (saleId: number) => ipcRenderer.invoke('sales:get-details', saleId),
  getClientLedger: (clientId: number) => ipcRenderer.invoke('clients:get-ledger', clientId),
  
  getProducts: () => ipcRenderer.invoke('get-products'),
  searchProducts: (query: string) => ipcRenderer.invoke('products:search', query),
  getProductByBarcode: (code: string) => ipcRenderer.invoke('products:by-barcode', code),
  createProduct: (product: any) => ipcRenderer.invoke('products:create', product),
  updateProduct: (product: any) => ipcRenderer.invoke('products:update', product),
  deleteProduct: (id: number) => ipcRenderer.invoke('products:delete', id),
  adjustProductStock: (id: number, delta: number) => ipcRenderer.invoke('products:adjust-stock', { id, delta }),
  seedProducts: () => ipcRenderer.invoke('products:seed'),
  
  payClientDebt: (clientId: number, montant: number) => ipcRenderer.invoke('clients:pay-debt', { clientId, montant }),
  createWholesaleSale: (payload: any) => ipcRenderer.invoke('sales:create-wholesale', payload),
  createRetailSale: (payload: any) => ipcRenderer.invoke('sales:create-retail', payload),
  printReceipt: (options?: { silent?: boolean; printerName?: string }) => ipcRenderer.invoke('print:receipt', options),
  getPrinters: () => ipcRenderer.invoke('print:get-printers'),

  // Charges (Frais d'exploitation / Dépenses) API
  getCharges: () => ipcRenderer.invoke('charges:get-all'),
  createCharge: (charge: any) => ipcRenderer.invoke('charges:create', charge),
  updateCharge: (charge: any) => ipcRenderer.invoke('charges:update', charge),
  deleteCharge: (id: number) => ipcRenderer.invoke('charges:delete', id),
  getChargesSummary: () => ipcRenderer.invoke('charges:get-summary'),

  // Suppliers (Fournisseurs) API
  getSuppliers: () => ipcRenderer.invoke('get-suppliers'),
  searchSuppliers: (query: string) => ipcRenderer.invoke('suppliers:search', query),
  createSupplier: (supplier: any) => ipcRenderer.invoke('suppliers:create', supplier),
  updateSupplier: (supplier: any) => ipcRenderer.invoke('suppliers:update', supplier),
  deleteSupplier: (id: number) => ipcRenderer.invoke('suppliers:delete', id),
  getSupplierInvoices: (supplierId: number) => ipcRenderer.invoke('suppliers:get-invoices', supplierId),
  getSupplierLedger: (supplierId: number) => ipcRenderer.invoke('suppliers:get-ledger', supplierId),
  createSupplierInvoice: (payload: any) => ipcRenderer.invoke('suppliers:create-invoice', payload),
  paySupplierDebt: (supplierId: number, montant: number, description?: string) =>
    ipcRenderer.invoke('suppliers:pay-debt', { supplierId, montant, description }),
  getSupplierProducts: (supplierId: number) => ipcRenderer.invoke('suppliers:get-products', supplierId),
  addSupplierProduct: (product: any) => ipcRenderer.invoke('suppliers:add-product', product),
  updateSupplierProduct: (product: any) => ipcRenderer.invoke('suppliers:update-product', product),
  deleteSupplierProduct: (id: number) => ipcRenderer.invoke('suppliers:delete-product', id),

  // Hardware Node-Locked Licensing API
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  getMachineId: () => ipcRenderer.invoke('license:get-machine-id'),
  activateLicense: (key: string) => ipcRenderer.invoke('license:activate', key),
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
