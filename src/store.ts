import { create } from 'zustand';

export interface Product {
  id: number;
  code_barre: string;
  nom: string;
  stock_actuel: number;
  seuil_alerte: number;
  prix_achat: number;
  prix_gros: number;
  prix_detail: number;
  date_expiration?: string;
  updated_at?: string;
}

export interface Client {
  id: number;
  nom: string;
  nom_magasin: string;
  telephone?: string;
  adresse: string;
  nif?: string;
  nis?: string;
  registre_numero?: string;
  total_dette: number;
  created_at?: string;
}

export interface Charge {
  id: number;
  titre: string;
  montant: number;
  categorie: string;
  notes?: string;
  date_charge: string;
}

export interface Supplier {
  id: number;
  nom: string;
  nom_societe: string;
  telephone?: string;
  adresse?: string;
  total_dette: number;
  created_at?: string;
}

export interface SupplierProduct {
  id: number;
  supplier_id: number;
  nom: string;
  reference?: string;
  prix_achat: number;
  categorie?: string;
  notes?: string;
  created_at?: string;
}

export interface SupplierInvoice {
  id: number;
  supplier_id: number;
  reference_facture?: string;
  description?: string;
  montant_total: number;
  montant_paye: number;
  dette_generee: number;
  created_at: string;
}

export interface SupplierLedgerRecord {
  id: number;
  supplier_id: number;
  invoice_id?: number | null;
  type_operation: 'FACTURE_ACHAT' | 'REGLEMENT_FOURNISSEUR';
  montant: number;
  solde_apres: number;
  description?: string;
  date_operation: string;
  reference_facture?: string;
  invoice_total?: number;
}

export interface CartItem {
  productId: number;
  code_barre: string;
  nom: string;
  stock_actuel: number;
  prix_achat: number;
  prix_vente: number;
  quantite: number;
  total_ligne: number;
}

interface AppState {
  clients: Client[];
  products: Product[];
  charges: Charge[];
  suppliers: Supplier[];
  isLoading: boolean;
  fetchClients: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchCharges: () => Promise<void>;
  fetchSuppliers: () => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'total_dette'>) => Promise<Client>;
  editClient: (client: Partial<Client> & { id: number }) => Promise<Client>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  editProduct: (product: Product) => Promise<Product>;
  removeProduct: (id: number) => Promise<void>;
  adjustProductStock: (id: number, delta: number) => Promise<void>;
  seedDemoData: () => Promise<void>;
  addCharge: (chargeData: Omit<Charge, 'id'>) => Promise<Charge>;
  editCharge: (charge: Charge) => Promise<Charge>;
  removeCharge: (id: number) => Promise<void>;
  addSupplier: (supplierData: Omit<Supplier, 'id'>) => Promise<Supplier>;
  editSupplier: (supplier: Partial<Supplier> & { id: number }) => Promise<Supplier>;
  removeSupplier: (id: number) => Promise<void>;
  fetchSupplierProducts: (supplierId: number) => Promise<SupplierProduct[]>;
  addSupplierProduct: (productData: Omit<SupplierProduct, 'id'>) => Promise<SupplierProduct>;
  editSupplierProduct: (productData: SupplierProduct) => Promise<SupplierProduct>;
  removeSupplierProduct: (id: number) => Promise<void>;
  fetchSupplierInvoices: (supplierId: number) => Promise<SupplierInvoice[]>;
  fetchSupplierLedger: (supplierId: number) => Promise<SupplierLedgerRecord[]>;
  createSupplierInvoice: (payload: any) => Promise<any>;
  paySupplierDebt: (supplierId: number, montant: number, description?: string) => Promise<any>;
}

export const useAppStore = create<AppState>((set, get) => ({
  clients: [],
  products: [],
  charges: [],
  suppliers: [],
  isLoading: false,
  fetchClients: async () => {
    // @ts-ignore
    const clients = await window.api.getClients();
    set({ clients: clients || [] });
  },
  addClient: async (clientData) => {
    // @ts-ignore
    const res = await window.api.createClient(clientData);
    await get().fetchClients();
    return res.client;
  },
  editClient: async (clientData) => {
    // @ts-ignore
    const res = await window.api.updateClient(clientData);
    await get().fetchClients();
    return res.client;
  },
  fetchProducts: async () => {
    set({ isLoading: true });
    try {
      // @ts-ignore
      const products = await window.api.getProducts();
      set({ products });
    } finally {
      set({ isLoading: false });
    }
  },
  addProduct: async (productData) => {
    // @ts-ignore
    const newProduct = await window.api.createProduct(productData);
    await get().fetchProducts();
    return newProduct;
  },
  editProduct: async (product) => {
    // @ts-ignore
    const updated = await window.api.updateProduct(product);
    await get().fetchProducts();
    return updated;
  },
  removeProduct: async (id) => {
    // @ts-ignore
    await window.api.deleteProduct(id);
    await get().fetchProducts();
  },
  adjustProductStock: async (id, delta) => {
    // @ts-ignore
    await window.api.adjustProductStock(id, delta);
    await get().fetchProducts();
  },
  seedDemoData: async () => {
    // @ts-ignore
    await window.api.seedProducts();
    await get().fetchProducts();
    await get().fetchClients();
    await get().fetchSuppliers();
  },

  // Charges
  fetchCharges: async () => {
    try {
      // @ts-ignore
      const charges = await window.api.getCharges();
      set({ charges: charges || [] });
    } catch (err) {
      console.error('Failed to fetch charges:', err);
    }
  },
  addCharge: async (chargeData) => {
    // @ts-ignore
    const res = await window.api.createCharge(chargeData);
    await get().fetchCharges();
    return res.charge;
  },
  editCharge: async (charge) => {
    // @ts-ignore
    const res = await window.api.updateCharge(charge);
    await get().fetchCharges();
    return res.charge;
  },
  removeCharge: async (id) => {
    // @ts-ignore
    await window.api.deleteCharge(id);
    await get().fetchCharges();
  },

  // Suppliers
  fetchSuppliers: async () => {
    try {
      // @ts-ignore
      const suppliers = await window.api.getSuppliers();
      set({ suppliers: suppliers || [] });
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  },
  addSupplier: async (supplierData) => {
    // @ts-ignore
    const res = await window.api.createSupplier(supplierData);
    await get().fetchSuppliers();
    return res.supplier;
  },
  editSupplier: async (supplier) => {
    // @ts-ignore
    const res = await window.api.updateSupplier(supplier);
    await get().fetchSuppliers();
    return res.supplier;
  },
  removeSupplier: async (id) => {
    // @ts-ignore
    await window.api.deleteSupplier(id);
    await get().fetchSuppliers();
  },
  fetchSupplierProducts: async (supplierId) => {
    // @ts-ignore
    return (await window.api.getSupplierProducts(supplierId)) || [];
  },
  addSupplierProduct: async (productData) => {
    // @ts-ignore
    const res = await window.api.addSupplierProduct(productData);
    return res.product;
  },
  editSupplierProduct: async (productData) => {
    // @ts-ignore
    const res = await window.api.updateSupplierProduct(productData);
    return res.product;
  },
  removeSupplierProduct: async (id) => {
    // @ts-ignore
    await window.api.deleteSupplierProduct(id);
  },
  fetchSupplierInvoices: async (supplierId) => {
    // @ts-ignore
    return (await window.api.getSupplierInvoices(supplierId)) || [];
  },
  fetchSupplierLedger: async (supplierId) => {
    // @ts-ignore
    return (await window.api.getSupplierLedger(supplierId)) || [];
  },
  createSupplierInvoice: async (payload) => {
    // @ts-ignore
    const res = await window.api.createSupplierInvoice(payload);
    await get().fetchSuppliers();
    return res;
  },
  paySupplierDebt: async (supplierId, montant, description) => {
    // @ts-ignore
    const res = await window.api.paySupplierDebt(supplierId, montant, description);
    await get().fetchSuppliers();
    return res;
  },
}));

interface WholesaleState {
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
  cart: CartItem[];
  addToCart: (product: Product) => boolean;
  updateCartItem: (productId: number, updates: Partial<CartItem>) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  montantVerse: number;
  setMontantVerse: (montant: number) => void;
}

export const useWholesaleStore = create<WholesaleState>((set, get) => ({
  selectedClient: null,
  setSelectedClient: (client) => set({ selectedClient: client }),
  
  cart: [],
  addToCart: (product) => {
    if (product.stock_actuel <= 0) {
      return false;
    }
    const { cart } = get();
    const existing = cart.find(item => item.productId === product.id);
    
    if (existing) {
      set({
        cart: cart.map(item => 
          item.productId === product.id 
            ? { ...item, quantite: item.quantite + 1, total_ligne: (item.quantite + 1) * item.prix_vente }
            : item
        )
      });
    } else {
      set({
        cart: [...cart, {
          productId: product.id,
          code_barre: product.code_barre,
          nom: product.nom,
          stock_actuel: product.stock_actuel,
          prix_achat: product.prix_achat,
          prix_vente: product.prix_gros, // default wholesale price
          quantite: 1,
          total_ligne: product.prix_gros
        }]
      });
    }
    return true;
  },
  
  updateCartItem: (productId, updates) => {
    const { cart } = get();
    set({
      cart: cart.map(item => {
        if (item.productId === productId) {
          const updated = { ...item, ...updates };
          if (updates.quantite !== undefined || updates.prix_vente !== undefined) {
            updated.total_ligne = updated.quantite * updated.prix_vente;
          }
          return updated;
        }
        return item;
      })
    });
  },
  
  removeFromCart: (productId) => {
    set({ cart: get().cart.filter(item => item.productId !== productId) });
  },
  
  clearCart: () => set({ cart: [], montantVerse: 0, selectedClient: null }),
  
  montantVerse: 0,
  setMontantVerse: (montant) => set({ montantVerse: montant }),
}));
