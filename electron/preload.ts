import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getClients: () => ipcRenderer.invoke('get-clients'),
  searchClients: (query: string) => ipcRenderer.invoke('clients:search', query),
  createClient: (client: any) => ipcRenderer.invoke('clients:create', client),
  
  getProducts: () => ipcRenderer.invoke('get-products'),
  searchProducts: (query: string) => ipcRenderer.invoke('products:search', query),
  getProductByBarcode: (code: string) => ipcRenderer.invoke('products:by-barcode', code),
  
  createWholesaleSale: (payload: any) => ipcRenderer.invoke('sales:create-wholesale', payload),
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
