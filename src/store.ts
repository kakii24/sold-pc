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
  updated_at?: string;
}

export interface Client {
  id: number;
  nom: string;
  nom_magasin: string;
  telephone?: string;
  adresse: string;
  total_dette: number;
  created_at?: string;
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
  isLoading: boolean;
  fetchClients: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'total_dette'>) => Promise<Client>;
  editClient: (client: Partial<Client> & { id: number }) => Promise<Client>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  editProduct: (product: Product) => Promise<Product>;
  removeProduct: (id: number) => Promise<void>;
  adjustProductStock: (id: number, delta: number) => Promise<void>;
  seedDemoData: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  clients: [],
  products: [],
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
