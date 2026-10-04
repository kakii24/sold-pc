import { create } from 'zustand';

export interface Product {
  id: number;
  code_barre: string;
  nom: string;
  stock_actuel: number;
  prix_achat: number;
  prix_gros: number;
  prix_detail: number;
}

export interface Client {
  id: number;
  nom: string;
  nom_magasin: string;
  adresse: string;
  total_dette: number;
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
  fetchClients: () => Promise<void>;
  fetchProducts: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  clients: [],
  products: [],
  fetchClients: async () => {
    // @ts-ignore
    const clients = await window.api.getClients();
    set({ clients });
  },
  fetchProducts: async () => {
    // @ts-ignore
    const products = await window.api.getProducts();
    set({ products });
  },
}));

interface WholesaleState {
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
  cart: CartItem[];
  addToCart: (product: Product) => void;
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
  },
  
  updateCartItem: (productId, updates) => {
    const { cart } = get();
    set({
      cart: cart.map(item => {
        if (item.productId === productId) {
          const updated = { ...item, ...updates };
          // Recalculate total if quantity or price changed
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
