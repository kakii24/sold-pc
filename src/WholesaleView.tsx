import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWholesaleStore } from './store';
import type { Client, Product } from './store';

// Icons mapping for visual elements without relying on an external package right now (or use Lucide if installed)
const SearchIcon = () => <span className="mr-2">🔍</span>;
const TrashIcon = () => <span>🗑️</span>;
const UserPlusIcon = () => <span>👤+</span>;

export const WholesaleView = () => {
  const { 
    selectedClient, setSelectedClient, 
    cart, addToCart, updateCartItem, removeFromCart, clearCart,
    montantVerse, setMontantVerse 
  } = useWholesaleStore();

  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [productQuery, setProductQuery] = useState('');
  
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  
  const productInputRef = useRef<HTMLInputElement>(null);

  // Focus management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Insert') {
        e.preventDefault();
        setIsClientModalOpen(true);
      }
      if (e.key === 'F2' || e.key === 'Escape') {
        e.preventDefault();
        productInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Client search
  useEffect(() => {
    if (clientQuery.length > 1) {
      // @ts-ignore
      window.api.searchClients(clientQuery).then(setClientResults);
      setShowClientDropdown(true);
    } else {
      setClientResults([]);
      setShowClientDropdown(false);
    }
  }, [clientQuery]);

  // Product search/scan
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productQuery.trim()) return;

    // Check if barcode
    // @ts-ignore
    const productByBarcode = await window.api.getProductByBarcode(productQuery);
    if (productByBarcode) {
      addToCart(productByBarcode);
      setProductQuery('');
      return;
    }

    // Otherwise show search results or something (for simplicity, we assume exact barcode or we could add a dropdown)
    // @ts-ignore
    const searchRes = await window.api.searchProducts(productQuery);
    if (searchRes.length > 0) {
      addToCart(searchRes[0]); // Just pick the first for now if it's text search
      setProductQuery('');
    } else {
      alert("Produit introuvable");
    }
  };

  const totalCommande = useMemo(() => cart.reduce((sum, item) => sum + item.total_ligne, 0), [cart]);
  
  // Set default montantVerse to totalCommande if it hasn't been modified
  useEffect(() => {
    if (cart.length > 0 && montantVerse === 0) {
      setMontantVerse(totalCommande);
    }
  }, [totalCommande]);

  const detteGeneree = Math.max(0, totalCommande - montantVerse);
  const ancienCredit = selectedClient?.total_dette || 0;
  const nouveauSolde = ancienCredit + detteGeneree;
  const aRendre = Math.max(0, montantVerse - totalCommande);

  const handleCheckout = async () => {
    if (!selectedClient) {
      alert("Veuillez sélectionner un client.");
      return;
    }
    if (cart.length === 0) {
      alert("Le panier est vide.");
      return;
    }

    try {
      // @ts-ignore
      await window.api.createWholesaleSale({
        clientId: selectedClient.id,
        items: cart,
        totalHt: totalCommande,
        montantVerse,
        detteGeneree
      });
      alert("Vente validée avec succès !");
      clearCart();
      setClientQuery('');
    } catch (err: any) {
      alert("Erreur lors de la vente: " + err.message);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-800">
      
      {/* Left Column: Client & Cart */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <h1 className="text-2xl font-bold mb-4 text-blue-900">Vente en Gros</h1>
        
        {/* Client Selection */}
        <div className="bg-white p-4 rounded-lg shadow mb-4 flex gap-4 items-end relative">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Rechercher Client</label>
            <input 
              type="text"
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
              placeholder="Nom ou magasin..."
              value={selectedClient ? selectedClient.nom + ' (' + selectedClient.nom_magasin + ')' : clientQuery}
              onChange={(e) => {
                if (selectedClient) setSelectedClient(null);
                setClientQuery(e.target.value);
              }}
            />
            {showClientDropdown && !selectedClient && clientResults.length > 0 && (
              <ul className="absolute z-10 w-[calc(100%-8rem)] bg-white border border-gray-200 mt-1 rounded shadow-lg max-h-48 overflow-auto">
                {clientResults.map(c => (
                  <li 
                    key={c.id} 
                    className="p-2 hover:bg-blue-100 cursor-pointer border-b text-black"
                    onClick={() => {
                      setSelectedClient(c);
                      setShowClientDropdown(false);
                      productInputRef.current?.focus();
                    }}
                  >
                    <span className="font-bold">{c.nom}</span> - {c.nom_magasin} 
                    <span className="ml-2 text-red-600 font-bold">(Dette: {c.total_dette.toFixed(2)} DA)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button 
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center shadow"
            onClick={() => setIsClientModalOpen(true)}
            title="Raccourci: Inserer"
          >
            <UserPlusIcon /> <span className="ml-2">Nouveau Client [Ins]</span>
          </button>
        </div>

        {/* Product Scan */}
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <form onSubmit={handleProductSubmit} className="flex items-center">
            <SearchIcon />
            <input
              ref={productInputRef}
              type="text"
              className="flex-1 border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg bg-white text-black"
              placeholder="Code-barres ou désignation [F2]..."
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              autoFocus
            />
          </form>
        </div>

        {/* Cart Table */}
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full text-left border-collapse tabular-nums">
              <thead className="bg-gray-200 text-gray-700 border-b-2 border-gray-300 sticky top-0">
                <tr>
                  <th className="p-3">Code-barre</th>
                  <th className="p-3">Désignation</th>
                  <th className="p-3 text-right">Stock</th>
                  <th className="p-3 text-right">Prix Gros (DA)</th>
                  <th className="p-3 text-right">Quantité</th>
                  <th className="p-3 text-right">Total (DA)</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.productId} className="border-b hover:bg-gray-50 text-black">
                    <td className="p-3 text-gray-500 font-mono">{item.code_barre}</td>
                    <td className="p-3 font-semibold">{item.nom}</td>
                    <td className="p-3 text-right">{item.stock_actuel}</td>
                    <td className="p-3 text-right">
                      <input 
                        type="number" 
                        className="w-24 border rounded p-1 text-right bg-white" 
                        value={item.prix_vente}
                        onChange={(e) => updateCartItem(item.productId, { prix_vente: Number(e.target.value) })}
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input 
                        type="number" 
                        className="w-20 border rounded p-1 text-right bg-white" 
                        value={item.quantite}
                        onChange={(e) => updateCartItem(item.productId, { quantite: Number(e.target.value) })}
                      />
                    </td>
                    <td className="p-3 text-right font-bold text-blue-800">
                      {item.total_ligne.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <button 
                        className="text-red-500 hover:text-red-700 p-1"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-gray-400">Le panier est vide.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Checkout Panel */}
      <div className="w-80 bg-gray-800 text-white flex flex-col p-6 shadow-xl border-l-4 border-gray-700">
        <h2 className="text-xl font-bold mb-6 text-gray-300 uppercase tracking-wider">Règlement</h2>
        
        {selectedClient && (
          <div className="bg-gray-700 p-4 rounded-lg mb-6 border border-gray-600">
            <p className="text-sm text-gray-400 uppercase">Ancien Crédit</p>
            <p className="text-3xl font-bold text-red-400">{ancienCredit.toFixed(2)} DA</p>
          </div>
        )}

        <div className="mb-6 space-y-4">
          <div>
            <p className="text-sm text-gray-400 uppercase">Total Bon</p>
            <p className="text-4xl font-black text-green-400">{totalCommande.toFixed(2)} DA</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-400 uppercase mb-1">Montant Versé</p>
            <input 
              type="number" 
              className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-2xl font-bold focus:outline-none focus:border-blue-500 text-white"
              value={montantVerse === 0 && totalCommande === 0 ? '' : montantVerse}
              onChange={(e) => setMontantVerse(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-3 mt-auto bg-gray-900 p-4 rounded-lg mb-6">
          <div className="flex justify-between">
            <span className="text-gray-400">À rendre:</span>
            <span className="font-bold text-yellow-400">{aRendre.toFixed(2)} DA</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Dette de la vente:</span>
            <span className="font-bold text-red-400">{detteGeneree.toFixed(2)} DA</span>
          </div>
          <div className="flex justify-between border-t border-gray-700 pt-2">
            <span className="text-gray-300 font-semibold">Nouveau Crédit:</span>
            <span className="font-bold text-red-500">{nouveauSolde.toFixed(2)} DA</span>
          </div>
        </div>

        <button 
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg shadow-lg text-lg transition-colors focus:ring-4 focus:ring-blue-800"
          onClick={handleCheckout}
        >
          VALIDER LA VENTE (F12)
        </button>
      </div>

      {/* New Client Modal */}
      {isClientModalOpen && (
        <NewClientModal 
          onClose={() => setIsClientModalOpen(false)}
          onSuccess={(newClient) => {
            setSelectedClient(newClient);
            setIsClientModalOpen(false);
            productInputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
};

const NewClientModal = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: (c: Client) => void }) => {
  const [nom, setNom] = useState('');
  const [magasin, setMagasin] = useState('');
  const [adresse, setAdresse] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // @ts-ignore
    const newClient = await window.api.createClient({ nom, nom_magasin: magasin, adresse });
    onSuccess(newClient);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md text-black">
        <h2 className="text-xl font-bold mb-4">Nouveau Client</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom & Prénom *</label>
            <input required autoFocus type="text" className="w-full border rounded p-2 bg-white text-black" value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom du Magasin *</label>
            <input required type="text" className="w-full border rounded p-2 bg-white text-black" value={magasin} onChange={e => setMagasin(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Adresse</label>
            <input type="text" className="w-full border rounded p-2 bg-white text-black" value={adresse} onChange={e => setAdresse(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100">Annuler</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
};
