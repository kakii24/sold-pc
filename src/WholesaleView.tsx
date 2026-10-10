import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWholesaleStore, useAppStore } from './store';
import type { Client, Product } from './store';
import { ReceiptPreviewModal, type ReceiptData } from './ReceiptPreviewModal';

// Icons mapping for visual elements
const SearchIcon = () => <span className="mr-2">🔍</span>;
const TrashIcon = () => <span>🗑️</span>;
const UserPlusIcon = () => <span>👤+</span>;

export const WholesaleView = () => {
  const { 
    selectedClient, setSelectedClient, 
    cart, addToCart, updateCartItem, removeFromCart, clearCart,
    montantVerse, setMontantVerse 
  } = useWholesaleStore();

  const { products, fetchProducts, fetchClients } = useAppStore();

  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [productQuery, setProductQuery] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogSelectedIndex, setCatalogSelectedIndex] = useState<number>(0);
  
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [currentReceiptData, setCurrentReceiptData] = useState<ReceiptData | null>(null);
  const [lastReceiptData, setLastReceiptData] = useState<ReceiptData | null>(null);

  const productInputRef = useRef<HTMLInputElement>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);
  const catalogListRef = useRef<HTMLDivElement>(null);

  // Load products & clients on mount
  useEffect(() => {
    fetchProducts();
    fetchClients();
  }, [fetchProducts, fetchClients]);

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Focus management & hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Insert') {
        e.preventDefault();
        setIsClientModalOpen(true);
      } else if (e.key === 'F6') {
        e.preventDefault();
        productInputRef.current?.focus();
      } else if (e.key === 'F9') {
        e.preventDefault();
        catalogInputRef.current?.focus();
        catalogInputRef.current?.select();
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (isDebtPaymentMode) {
          handleDebtPayment();
        } else {
          handleCheckout();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowClientDropdown(false);
        productInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

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

  // Filter available products catalog with live letter search
  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => 
      p.nom.toLowerCase().includes(q) || 
      (p.code_barre && p.code_barre.toLowerCase().includes(q))
    );
  }, [products, catalogQuery]);

  // Keep catalog selection index valid when filtered items change
  useEffect(() => {
    setCatalogSelectedIndex(0);
  }, [catalogQuery]);

  // Handle adding product from catalog with stock guard
  const handleAddProduct = (product: Product) => {
    if (product.stock_actuel <= 0) {
      showToast(`⚠️ "${product.nom}" est en rupture de stock !`);
      return;
    }
    const success = addToCart(product);
    if (success) {
      showToast(`✓ "${product.nom}" ajouté au panier`);
    }
  };

  // Keyboard navigation inside the catalog search input
  const handleCatalogKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredCatalog.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCatalogSelectedIndex(prev => Math.min(filteredCatalog.length - 1, prev + 1));
      scrollCatalogItemIntoView(Math.min(filteredCatalog.length - 1, catalogSelectedIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCatalogSelectedIndex(prev => Math.max(0, prev - 1));
      scrollCatalogItemIntoView(Math.max(0, catalogSelectedIndex - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCatalog[catalogSelectedIndex];
      if (selected) {
        handleAddProduct(selected);
      }
    }
  };

  const scrollCatalogItemIntoView = (index: number) => {
    if (!catalogListRef.current) return;
    const items = catalogListRef.current.children;
    if (items && items[index]) {
      (items[index] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  // Product barcode scan or submit
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productQuery.trim()) return;

    // @ts-ignore
    const productByBarcode = await window.api.getProductByBarcode(productQuery.trim());
    if (productByBarcode) {
      handleAddProduct(productByBarcode);
      setProductQuery('');
      return;
    }

    // Text search fallback
    // @ts-ignore
    const searchRes = await window.api.searchProducts(productQuery.trim());
    if (searchRes.length > 0) {
      handleAddProduct(searchRes[0]);
      setProductQuery('');
    } else {
      alert("Produit introuvable pour ce code ou cette désignation.");
    }
  };

  const totalCommande = useMemo(() => cart.reduce((sum, item) => sum + item.total_ligne, 0), [cart]);

  // Mode detection: Direct Debt Payment vs Wholesale Sale
  const isDebtPaymentMode = Boolean(
    selectedClient && 
    (selectedClient.total_dette || 0) > 0 && 
    cart.length === 0
  );

  // Set default montantVerse to totalCommande for sale mode
  useEffect(() => {
    if (!isDebtPaymentMode && cart.length > 0 && montantVerse === 0) {
      setMontantVerse(totalCommande);
    }
  }, [totalCommande, isDebtPaymentMode]);

  // Calculations for Sale Mode
  const detteGeneree = Math.max(0, totalCommande - montantVerse);
  const ancienCredit = selectedClient?.total_dette || 0;
  const nouveauSoldeVente = ancienCredit + detteGeneree;
  const aRendreVente = Math.max(0, montantVerse - totalCommande);

  // Calculations for Debt Payment Mode
  const montantPayeDette = Math.min(ancienCredit, montantVerse);
  const nouveauSoldeDette = Math.max(0, ancienCredit - montantPayeDette);
  const aRendreDette = Math.max(0, montantVerse - ancienCredit);

  // Submit wholesale sale
  const handleCheckout = async () => {
    if (!selectedClient) {
      showToast("Veuillez sélectionner un client.");
      return;
    }
    if (cart.length === 0) {
      showToast("Le panier est vide.");
      return;
    }

    setIsSubmitting(true);
    try {
      // @ts-ignore
      const res = await window.api.createWholesaleSale({
        clientId: selectedClient.id,
        items: cart,
        totalHt: totalCommande,
        montantVerse,
        detteGeneree
      });

      const receipt: ReceiptData = {
        saleId: res?.saleId || 1,
        type_vente: 'GROS',
        items: cart.map(item => ({
          nom: item.nom,
          code_barre: item.code_barre,
          quantite: item.quantite,
          prix_vente: item.prix_vente,
          total_ligne: item.total_ligne,
        })),
        total_ht: totalCommande,
        montant_verse: montantVerse,
        client: {
          nom: selectedClient.nom,
          nom_magasin: selectedClient.nom_magasin,
          telephone: selectedClient.telephone,
          adresse: selectedClient.adresse,
        },
        ancien_credit: ancienCredit,
        dette_vente: detteGeneree,
        nouveau_solde: nouveauSoldeTotal,
        date: new Date().toISOString(),
      };

      setLastReceiptData(receipt);
      showToast("Vente en gros validée avec succès !");

      const autoPrint = localStorage.getItem('pos_auto_print') === 'true';
      if (autoPrint) {
        // @ts-ignore
        if (window.api && window.api.printReceipt) {
          // @ts-ignore
          window.api.printReceipt({ silent: true }).catch(() => {});
        }
      } else {
        setCurrentReceiptData(receipt);
        setReceiptModalOpen(true);
      }

      clearCart();
      setClientQuery('');
      fetchProducts();
      fetchClients();
    } catch (err: any) {
      showToast("Erreur lors de la vente: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview ticket manually (always opens modal with safe fallbacks)
  const handlePreviewTicket = () => {
    try {
      const itemsToUse = cart.length > 0 
        ? cart.map(item => ({
            nom: item.nom || 'Article',
            code_barre: item.code_barre || '',
            quantite: Number(item.quantite) || 1,
            prix_vente: Number(item.prix_vente) || 0,
            total_ligne: Number(item.total_ligne) || ((Number(item.quantite) || 1) * (Number(item.prix_vente) || 0)),
          }))
        : (lastReceiptData?.items || []);

      const totalHt = cart.length > 0 
        ? totalCommande 
        : (lastReceiptData?.total_ht || 0);

      const vers = cart.length > 0 
        ? montantVerse 
        : (lastReceiptData?.montant_verse || 0);

      const previewData: ReceiptData = {
        saleId: lastReceiptData ? lastReceiptData.saleId : 1,
        type_vente: 'GROS',
        items: itemsToUse,
        total_ht: totalHt,
        montant_verse: vers,
        client: selectedClient ? {
          nom: selectedClient.nom || '',
          nom_magasin: selectedClient.nom_magasin || '',
          telephone: selectedClient.telephone || '',
          adresse: selectedClient.adresse || '',
        } : (lastReceiptData?.client || undefined),
        ancien_credit: selectedClient ? ancienCredit : (lastReceiptData?.ancien_credit || 0),
        dette_vente: selectedClient ? detteGeneree : (lastReceiptData?.dette_vente || 0),
        nouveau_solde: selectedClient ? nouveauSoldeTotal : (lastReceiptData?.nouveau_solde || 0),
        date: new Date().toISOString(),
      };

      setCurrentReceiptData(previewData);
      setReceiptModalOpen(true);
    } catch (err: any) {
      console.error('Receipt preview error:', err);
      setCurrentReceiptData({
        saleId: 1,
        type_vente: 'GROS',
        items: [],
        total_ht: 0,
        montant_verse: 0,
        client: selectedClient ? {
          nom: selectedClient.nom || '',
          nom_magasin: selectedClient.nom_magasin || '',
        } : undefined,
        date: new Date().toISOString(),
      });
      setReceiptModalOpen(true);
    }
  };

  // Submit direct debt payment
  const handleDebtPayment = async () => {
    if (!selectedClient) {
      alert("Veuillez sélectionner un client.");
      return;
    }
    if (montantVerse <= 0) {
      alert("Veuillez saisir un montant versé valide.");
      return;
    }

    setIsSubmitting(true);
    try {
      // @ts-ignore
      const res = await window.api.payClientDebt(selectedClient.id, montantVerse);
      if (res && res.success === false) {
        alert("Erreur lors du versement: " + res.error);
        return;
      }

      // Update client state reactively on screen without reload
      if (res && res.client) {
        setSelectedClient(res.client);
      }
      await fetchClients();
      setMontantVerse(0);
      alert(`✅ Versement de ${res.montantPaye.toFixed(2)} DA enregistré avec succès !\nNouveau solde dette: ${res.nouveauSolde.toFixed(2)} DA`);
    } catch (err: any) {
      console.error("Debt payment error:", err);
      alert("Erreur: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full h-full flex-1 bg-gray-100 font-sans text-gray-800 overflow-hidden relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 backdrop-blur-xs text-white px-4 py-2 rounded-lg shadow-xl text-sm font-semibold flex items-center gap-2 border border-gray-700 animate-in fade-in slide-in-from-top duration-200">
          {toastMessage}
        </div>
      )}

      {/* 1. Left Column: Client Selection & Cart Table */}
      <div className="flex-1 flex flex-col p-2.5 overflow-hidden min-w-0">
        {/* Compact Breadcrumb & Shortcut Hints */}
        <div className="flex items-center justify-between px-1 mb-1.5 text-xs">
          <span className="font-bold text-gray-800 flex items-center gap-1.5">
            <span>🛒</span> Bon de Vente en Gros
          </span>
          <span className="text-[11px] text-gray-400 font-mono">
            [F6] Scanner • [F9] Catalogue • [Ins] Nouveau Client • [F12] Valider
          </span>
        </div>
        
        {/* Consolidated Single Compact Input Row */}
        <div className="bg-white p-1.5 rounded-xl shadow-xs border border-gray-200 mb-2 flex items-center gap-2 relative shrink-0">
          {/* Client Search (Left ~45%) */}
          <div className="flex-[45] relative flex items-center min-w-0">
            {selectedClient ? (
              <div className="flex-1 flex items-center justify-between bg-blue-50/70 border border-blue-200 rounded-lg px-2.5 py-1 text-xs min-w-0">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-blue-700 font-bold truncate">👤 {selectedClient.nom}</span>
                  <span className="text-gray-500 font-medium truncate">({selectedClient.nom_magasin})</span>
                  {selectedClient.total_dette > 0 ? (
                    <span className="text-[10px] font-black font-mono bg-red-100 text-red-700 px-1.5 py-0.2 rounded shrink-0">
                      Dette: {selectedClient.total_dette.toFixed(2)} DA
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded shrink-0">
                      À jour
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setClientQuery('');
                  }}
                  title="Changer de client"
                  className="text-gray-400 hover:text-red-600 font-bold ml-1.5 p-0.5 rounded cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex-1 relative flex items-center">
                <span className="absolute left-2.5 text-gray-400 pointer-events-none text-xs">👤</span>
                <input 
                  type="text"
                  className="w-full pl-7 pr-3 py-1.5 bg-gray-50 focus:bg-white border border-gray-300 focus:border-blue-500 rounded-lg text-xs font-medium text-gray-900 focus:outline-none transition-colors placeholder:text-gray-400"
                  placeholder="Rechercher client (ou [Ins] pour créer)..."
                  value={clientQuery}
                  onChange={(e) => {
                    setClientQuery(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && clientResults.length === 0 && clientQuery.trim().length > 0) {
                      e.preventDefault();
                      setIsClientModalOpen(true);
                    }
                  }}
                />
                {showClientDropdown && !selectedClient && (
                  <ul className="absolute z-40 left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-auto divide-y divide-gray-100 text-xs">
                    {clientResults.map(c => (
                      <li 
                        key={c.id} 
                        className="p-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                        onClick={() => {
                          setSelectedClient(c);
                          setShowClientDropdown(false);
                          productInputRef.current?.focus();
                        }}
                      >
                        <div className="truncate">
                          <span className="font-bold text-gray-900">{c.nom}</span>
                          <span className="text-gray-600 ml-1.5 font-medium">({c.nom_magasin})</span>
                          {c.telephone && <span className="text-gray-400 font-mono ml-1.5 text-[10px]">📞 {c.telephone}</span>}
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 font-mono ${c.total_dette > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {c.total_dette > 0 ? `${c.total_dette.toFixed(2)} DA` : '0 DA'}
                        </span>
                      </li>
                    ))}
                    {clientResults.length === 0 && clientQuery.trim().length > 0 && (
                      <li
                        className="p-2.5 text-center text-blue-600 hover:bg-blue-50 cursor-pointer font-bold transition-colors flex items-center justify-center gap-1.5"
                        onClick={() => setIsClientModalOpen(true)}
                      >
                        <span>👤+</span>
                        <span>Aucun résultat — Créer "{clientQuery}" [Ins]</span>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Vertical Divider */}
          <div className="h-6 w-px bg-gray-200 shrink-0"></div>

          {/* Fast Product Barcode Scan (Right ~55%) */}
          <form onSubmit={handleProductSubmit} className="flex-[55] flex items-center gap-1.5 min-w-0">
            <div className="flex-1 relative flex items-center">
              <span className="absolute left-2.5 text-gray-400 pointer-events-none text-xs">🔍</span>
              <input
                ref={productInputRef}
                type="text"
                className="w-full pl-7 pr-3 py-1.5 bg-gray-50 focus:bg-white border border-gray-300 focus:border-blue-500 rounded-lg text-xs font-medium text-gray-900 focus:outline-none transition-colors placeholder:text-gray-400"
                placeholder="Scanner code-barres ou taper désignation [F6]..."
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-xs shrink-0 cursor-pointer"
            >
              Ajouter ↵
            </button>
          </form>
        </div>

        {/* Cart Table (Maximized vertical height) */}
        <div className="flex-1 bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden flex flex-col min-h-0">
          <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex justify-between items-center shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
              <span>Articles du Bon</span>
              <span className="bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded-full font-mono text-[10px]">
                {cart.length}
              </span>
            </span>
            {cart.length > 0 && (
              <button 
                onClick={clearCart}
                className="text-[11px] text-red-600 hover:text-red-800 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Vider le panier</span>
                <span className="text-[9px] font-mono opacity-60">[Échap]</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="min-w-full text-left border-collapse tabular-nums text-xs">
              <thead className="bg-gray-100/90 text-gray-600 border-b border-gray-200 sticky top-0 font-bold z-10 text-[11px] uppercase tracking-wider select-none">
                <tr>
                  <th className="py-1.5 px-2.5">Code-barre</th>
                  <th className="py-1.5 px-2.5">Désignation</th>
                  <th className="py-1.5 px-2.5 text-right">Stock</th>
                  <th className="py-1.5 px-2.5 text-right">Prix Gros (DA)</th>
                  <th className="py-1.5 px-2.5 text-right">Quantité</th>
                  <th className="py-1.5 px-2.5 text-right">Total (DA)</th>
                  <th className="py-1.5 px-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cart.map(item => (
                  <tr key={item.productId} className="hover:bg-blue-50/50 transition-colors">
                    <td className="py-1.5 px-2.5 text-gray-500 font-mono text-[11px]">{item.code_barre || '-'}</td>
                    <td className="py-1.5 px-2.5 font-bold text-gray-900">{item.nom}</td>
                    <td className="py-1.5 px-2.5 text-right">
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 font-semibold font-mono">
                        {item.stock_actuel}
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 text-right">
                      <input 
                        type="number" 
                        step="any"
                        className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-right bg-white font-mono font-semibold focus:ring-1 focus:ring-blue-500 text-xs" 
                        value={item.prix_vente}
                        onChange={(e) => updateCartItem(item.productId, { prix_vente: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-1.5 px-2.5 text-right">
                      <input 
                        type="number" 
                        min="1"
                        className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-right bg-white font-mono font-bold focus:ring-1 focus:ring-blue-500 text-xs" 
                        value={item.quantite}
                        onChange={(e) => updateCartItem(item.productId, { quantite: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-black text-blue-900 font-mono text-xs">
                      {item.total_ligne.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2.5 text-center">
                      <button 
                        className="text-gray-400 hover:text-red-600 p-0.5 transition-colors cursor-pointer"
                        onClick={() => removeFromCart(item.productId)}
                        title="Retirer l'article"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-2xl">🛒</span>
                        <p className="font-bold text-gray-600 text-xs">Le panier est vide</p>
                        <p className="text-[11px] text-gray-400">
                          Sélectionnez des articles dans le catalogue ou scannez un code-barres [F6].
                        </p>
                        {isDebtPaymentMode && (
                          <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 text-xs font-medium max-w-sm">
                            💡 <strong>Mode Versement Actif :</strong> Enregistrez un versement direct de dette sur le panneau de droite.
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Middle Column: Available Products Catalog with Live Letter Search */}
      <div className="w-72 xl:w-80 flex flex-col p-2.5 pl-0 overflow-hidden shrink-0">
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 flex flex-col h-full overflow-hidden">
          
          {/* Catalog Header */}
          <div className="p-2 px-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                <span>📦</span> Produits Disponibles
              </h2>
              <p className="text-[10px] text-gray-500">Filtrage instantané & ajout [F9]</p>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
              {filteredCatalog.length}
            </span>
          </div>

          {/* Live Search Input */}
          <div className="p-2 border-b border-gray-100 bg-white">
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
              <input
                ref={catalogInputRef}
                type="text"
                className="w-full pl-7 pr-6 py-1.5 border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400"
                placeholder="Filtrer en direct (lettres ou code)..."
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                onKeyDown={handleCatalogKeyDown}
              />
              {catalogQuery && (
                <button
                  type="button"
                  onClick={() => setCatalogQuery('')}
                  className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex justify-between items-center mt-1 text-[10px] text-gray-400">
              <span>↑/↓ pour naviguer</span>
              <span>[Entrée] pour ajouter</span>
            </div>
          </div>

          {/* Catalog Product List */}
          <div ref={catalogListRef} className="flex-1 overflow-y-auto divide-y divide-gray-100 p-1.5 space-y-1">
            {filteredCatalog.map((product, idx) => {
              const isOutOfStock = product.stock_actuel <= 0;
              const isLowStock = product.stock_actuel <= product.seuil_alerte && !isOutOfStock;
              const isSelected = idx === catalogSelectedIndex;

              return (
                <div
                  key={product.id}
                  onClick={() => handleAddProduct(product)}
                  className={`p-2 rounded-lg transition-all cursor-pointer select-none flex flex-col gap-0.5 border ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50/70 shadow-xs' 
                      : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                  } ${isOutOfStock ? 'opacity-60 bg-gray-50/50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex justify-between items-start gap-1.5">
                    <span className="font-bold text-xs text-gray-900 line-clamp-1 leading-snug">
                      {product.nom}
                    </span>
                    <span className="text-xs font-black font-mono text-blue-700 whitespace-nowrap">
                      {product.prix_gros.toFixed(2)} DA
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] mt-0.5">
                    <span className="font-mono text-gray-400 text-[10px]">
                      {product.code_barre || '-'}
                    </span>

                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isOutOfStock
                          ? 'bg-red-100 text-red-800'
                          : isLowStock
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isOutOfStock ? '🚫 Rupture' : `${product.stock_actuel} en stock`}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredCatalog.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-xs">
                <span>🔍</span>
                <p className="mt-1 font-medium">Aucun article ne correspond à "{catalogQuery}"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Right Column: Settlement Panel (Adapts between Sale & Direct Debt Payment) */}
      <div className="w-72 xl:w-80 bg-gray-900 text-white flex flex-col p-3 shadow-2xl border-l border-gray-800 shrink-0 overflow-y-auto">
        
        {/* Panel Header */}
        <div className="mb-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black tracking-wider uppercase text-gray-200">
              {isDebtPaymentMode ? 'Règlement Dette' : 'Règlement Vente'}
            </h2>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
              isDebtPaymentMode ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              {isDebtPaymentMode ? 'Versement' : 'Gros'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {isDebtPaymentMode ? 'Paiement direct de créance' : 'Facturation du bon de commande'}
          </p>
        </div>

        {/* Client Credit Status Card */}
        {selectedClient ? (
          <div className="bg-gray-800/90 p-2.5 rounded-lg mb-2.5 border border-gray-700">
            <div className="flex justify-between items-start">
              <div className="truncate pr-1">
                <p className="text-xs font-bold text-gray-200 truncate">{selectedClient.nom}</p>
                <p className="text-[11px] text-gray-400 truncate">{selectedClient.nom_magasin}</p>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                selectedClient.total_dette > 0 ? 'bg-red-900/60 text-red-300' : 'bg-green-900/60 text-green-300'
              }`}>
                {selectedClient.total_dette > 0 ? 'Débiteur' : 'En règle'}
              </span>
            </div>
            
            <div className="mt-2 pt-1.5 border-t border-gray-700/60 flex justify-between items-baseline">
              <span className="text-[11px] text-gray-400 uppercase font-semibold">Dette Actuelle :</span>
              <span className={`text-base font-black font-mono ${selectedClient.total_dette > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {selectedClient.total_dette.toFixed(2)} DA
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/50 p-2 rounded-lg mb-2.5 border border-gray-700 text-xs text-gray-400 text-center">
            Aucun client sélectionné
          </div>
        )}

        {/* Mode 1: DIRECT DEBT REPAYMENT FLOW (When client has debt and cart is empty) */}
        {isDebtPaymentMode ? (
          <div className="flex-1 flex flex-col justify-between space-y-2.5">
            <div className="space-y-2.5">
              {/* Payment input */}
              <div>
                <label className="block text-[11px] uppercase font-bold text-purple-300 mb-1">
                  Montant du Versement (DA) *
                </label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  autoFocus
                  className="w-full bg-gray-950 border-2 border-purple-500 rounded-lg p-2 text-xl font-black font-mono focus:outline-none focus:border-purple-400 text-white"
                  placeholder="0.00"
                  value={montantVerse === 0 ? '' : montantVerse}
                  onChange={(e) => setMontantVerse(Number(e.target.value))}
                />
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <p className="text-[10px] text-gray-400 mb-1 font-medium">Raccourcis de paiement :</p>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setMontantVerse(ancienCredit)}
                    className="p-1 bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700 rounded text-center truncate"
                  >
                    Totalité ({ancienCredit.toFixed(0)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMontantVerse(5000)}
                    className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-center"
                  >
                    5 000 DA
                  </button>
                  <button
                    type="button"
                    onClick={() => setMontantVerse(10000)}
                    className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-center"
                  >
                    10 000 DA
                  </button>
                  <button
                    type="button"
                    onClick={() => setMontantVerse(20000)}
                    className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-center"
                  >
                    20 000 DA
                  </button>
                </div>
              </div>

              {/* Calculation Summary Box */}
              <div className="bg-gray-950/80 p-2.5 rounded-lg border border-gray-800 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-gray-400 text-[11px]">
                  <span>Dette avant versement :</span>
                  <span>{ancienCredit.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between text-purple-300 font-bold text-[11px]">
                  <span>Versement appliqué :</span>
                  <span>- {montantPayeDette.toFixed(2)} DA</span>
                </div>
                {aRendreDette > 0 && (
                  <div className="flex justify-between text-yellow-400 font-bold text-[11px]">
                    <span>Monnaie à rendre :</span>
                    <span>{aRendreDette.toFixed(2)} DA</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-800 pt-1.5 text-xs font-black">
                  <span className="text-gray-200">Nouveau Solde Dette :</span>
                  <span className={nouveauSoldeDette === 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {nouveauSoldeDette.toFixed(2)} DA
                  </span>
                </div>
              </div>
            </div>

            {/* Confirm Debt Payment Button */}
            <button 
              disabled={montantVerse <= 0 || isSubmitting}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-black py-2.5 rounded-lg shadow-lg text-sm tracking-wide transition-all focus:ring-4 focus:ring-purple-800 cursor-pointer"
              onClick={handleDebtPayment}
            >
              {isSubmitting ? 'ENREGISTREMENT...' : 'ENREGISTRER VERSEMENT (F12)'}
            </button>
          </div>
        ) : (
          /* Mode 2: STANDARD WHOLESALE SALE FLOW (Cart has items or empty cart without debt) */
          <div className="flex-1 flex flex-col justify-between space-y-2.5">
            <div className="space-y-2.5">
              {/* Total Bon */}
              <div className="bg-gray-800/60 p-2.5 rounded-lg border border-gray-700">
                <p className="text-[11px] text-gray-400 uppercase font-semibold">Total Bon (HT)</p>
                <p className="text-2xl font-black text-green-400 font-mono">{totalCommande.toFixed(2)} DA</p>
              </div>
              
              {/* Montant Versé */}
              <div>
                <div className="flex justify-between text-[11px] text-gray-400 uppercase mb-1 font-semibold">
                  <span>Montant Versé</span>
                  {totalCommande > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setMontantVerse(totalCommande)}
                      className="text-blue-400 hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      Payé exact
                    </button>
                  )}
                </div>
                <input 
                  type="number" 
                  step="any"
                  className="w-full bg-gray-950 border border-gray-600 rounded-lg p-2 text-xl font-bold font-mono focus:outline-none focus:border-blue-500 text-white"
                  value={montantVerse === 0 && totalCommande === 0 ? '' : montantVerse}
                  onChange={(e) => setMontantVerse(Number(e.target.value))}
                />
              </div>

              {/* Calculations for Sale */}
              <div className="bg-gray-950/80 p-2.5 rounded-lg border border-gray-800 space-y-1 text-xs font-mono">
                <div className="flex justify-between text-gray-400 text-[11px]">
                  <span>À rendre :</span>
                  <span className="font-bold text-yellow-400">{aRendreVente.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between text-gray-400 text-[11px]">
                  <span>Dette générée :</span>
                  <span className="font-bold text-red-400">{detteGeneree.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between border-t border-gray-800 pt-1 text-xs font-black">
                  <span className="text-gray-300">Nouveau Crédit :</span>
                  <span className={nouveauSoldeVente > 0 ? 'text-red-400' : 'text-emerald-400'}>
                    {nouveauSoldeVente.toFixed(2)} DA
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {/* Validate Sale Button */}
              <button 
                disabled={cart.length === 0 || isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-black py-2.5 rounded-lg shadow-lg text-sm tracking-wide transition-all focus:ring-4 focus:ring-blue-800 cursor-pointer"
                onClick={handleCheckout}
              >
                {isSubmitting ? 'VALIDATION...' : cart.length === 0 ? 'PANIER VIDE' : 'VALIDER LA VENTE (F12)'}
              </button>

              {/* Ticket Preview / Print Button */}
              <button
                type="button"
                onClick={handlePreviewTicket}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-bold py-1.5 rounded-lg border border-gray-700 transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <span>🧾</span>
                <span>Aperçu / Imprimer Ticket</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Client Modal */}
      {isClientModalOpen && (
        <NewClientModal 
          initialNom={clientQuery}
          onClose={() => setIsClientModalOpen(false)}
          onSuccess={(newClient) => {
            setSelectedClient(newClient);
            setIsClientModalOpen(false);
            setClientQuery('');
            productInputRef.current?.focus();
          }}
        />
      )}

      {/* Thermal Receipt Preview Modal */}
      <ReceiptPreviewModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receiptData={currentReceiptData}
      />
    </div>
  );
};

const NewClientModal = ({ initialNom = '', onClose, onSuccess }: { initialNom?: string; onClose: () => void; onSuccess: (c: Client) => void }) => {
  const [nom, setNom] = useState(initialNom);
  const [magasin, setMagasin] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // @ts-ignore
      const res = await window.api.createClient({
        nom: nom.trim(),
        nom_magasin: magasin.trim(),
        telephone: telephone.trim(),
        adresse: adresse.trim(),
      });

      if (res && res.success === false) {
        alert("Erreur lors de la création du client: " + res.error);
        return;
      }

      const newClient = res && res.client ? res.client : res;
      if (newClient && newClient.id) {
        onSuccess(newClient);
      } else {
        alert("Impossible de créer le client.");
      }
    } catch (err: any) {
      console.error("Client creation error:", err);
      alert("Erreur: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md text-gray-900 border border-gray-200">
        <h2 className="text-xl font-bold mb-4">Nouveau Client</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Nom & Prénom *</label>
            <input required autoFocus type="text" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500" placeholder="ex: Karim Mansouri" value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Nom du Magasin *</label>
            <input required type="text" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500" placeholder="ex: Supérette Les Oliviers" value={magasin} onChange={e => setMagasin(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Numéro de Téléphone</label>
            <input type="tel" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 font-mono" placeholder="ex: 0550 12 34 56" value={telephone} onChange={e => setTelephone(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Adresse</label>
            <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500" placeholder="ex: Alger, Kouba..." value={adresse} onChange={e => setAdresse(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 font-medium">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-bold shadow-sm transition-colors">
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
