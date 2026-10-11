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

  // Hardware Node-Locked Licensing API
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  getMachineId: () => ipcRenderer.invoke('license:get-machine-id'),
  activateLicense: (key: string) => ipcRenderer.invoke('license:activate', key),
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;

