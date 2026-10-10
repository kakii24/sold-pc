import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from './store';
import type { Product } from './store';
import { ReceiptPreviewModal, type ReceiptData } from './ReceiptPreviewModal';

export interface RetailCartItem {
  productId: number;
  code_barre: string;
  nom: string;
  stock_actuel: number;
  prix_achat: number;
  prix_vente: number; // Retail price (prix_detail)
  quantite: number;
  total_ligne: number;
}

export const RetailView: React.FC = () => {
  const { products, fetchProducts } = useAppStore();

  // Cart state
  const [cart, setCart] = useState<RetailCartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [montantRecu, setMontantRecu] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receipt Preview & Print State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [currentReceiptData, setCurrentReceiptData] = useState<ReceiptData | null>(null);
  const [lastReceiptData, setLastReceiptData] = useState<ReceiptData | null>(null);

  // Quick catalog toggle & search
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogSelectedIndex, setCatalogSelectedIndex] = useState(0);

  // Search dropdown for barcode input matching
  const [searchMatches, setSearchMatches] = useState<Product[]>([]);
  const [showMatchesDropdown, setShowMatchesDropdown] = useState(false);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const catalogListRef = useRef<HTMLDivElement>(null);

  // Audio feedback helper
  const playBeep = (freq = 880, type: OscillatorType = 'sine', duration = 0.08) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  const showToast = (text: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Initial load & persistent autofocus
  useEffect(() => {
    fetchProducts();
    barcodeInputRef.current?.focus();
  }, [fetchProducts]);

  // Total calculation
  const totalAPayer = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total_ligne, 0);
  }, [cart]);

  const montantRecuNum = Number(montantRecu) || 0;
  const monnaieARendre = Math.max(0, montantRecuNum - totalAPayer);
  const isPaymentSufficient = montantRecuNum >= totalAPayer && totalAPayer > 0;
  const montantManquant = Math.max(0, totalAPayer - montantRecuNum);

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.nom.toLowerCase().includes(q) ||
        p.code_barre.toLowerCase().includes(q)
    );
  }, [products, catalogQuery]);

  // Handle typing in barcode field (auto-suggest by name or barcode)
  useEffect(() => {
    const q = barcodeInput.trim().toLowerCase();
    if (q.length >= 2) {
      const matches = products.filter(
        (p) =>
          p.nom.toLowerCase().includes(q) ||
          p.code_barre.toLowerCase().includes(q)
      ).slice(0, 8);
      setSearchMatches(matches);
      setShowMatchesDropdown(matches.length > 0);
      setSelectedMatchIndex(0);
    } else {
      setSearchMatches([]);
      setShowMatchesDropdown(false);
    }
  }, [barcodeInput, products]);

  // Add product to cart with strict stock checking and retail price
  const addProductToCart = (product: Product, quantityToAdd = 1): boolean => {
    if (product.stock_actuel <= 0) {
      playBeep(300, 'sawtooth', 0.15);
      showToast(`Article "${product.nom}" en rupture de stock (0 disponible).`, 'error');
      return false;
    }

    const existingIndex = cart.findIndex((item) => item.productId === product.id);

    if (existingIndex >= 0) {
      const currentQty = cart[existingIndex].quantite;
      const newQty = currentQty + quantityToAdd;

      if (newQty > product.stock_actuel) {
        playBeep(350, 'sawtooth', 0.15);
        showToast(
          `Stock insuffisant pour "${product.nom}". Disponible : ${product.stock_actuel} (dans panier : ${currentQty}).`,
          'warning'
        );
        return false;
      }

      const updated = [...cart];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantite: newQty,
        total_ligne: newQty * updated[existingIndex].prix_vente,
      };
      setCart(updated);
    } else {
      if (quantityToAdd > product.stock_actuel) {
        playBeep(350, 'sawtooth', 0.15);
        showToast(
          `Stock insuffisant pour "${product.nom}". Disponible : ${product.stock_actuel}.`,
          'warning'
        );
        return false;
      }

      setCart([
        ...cart,
        {
          productId: product.id,
          code_barre: product.code_barre,
          nom: product.nom,
          stock_actuel: product.stock_actuel,
          prix_achat: product.prix_achat,
          prix_vente: product.prix_detail, // RETAIL PRICE APPLIED
          quantite: quantityToAdd,
          total_ligne: quantityToAdd * product.prix_detail,
        },
      ]);
    }

    playBeep(980, 'sine', 0.06);
    return true;
  };

  // Update item quantity in cart with inventory guard
  const updateItemQuantity = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    if (newQty > item.stock_actuel) {
      playBeep(350, 'sawtooth', 0.15);
      showToast(
        `Quantité max atteinte ! Seulement ${item.stock_actuel} en stock pour "${item.nom}".`,
        'warning'
      );
      return;
    }

    setCart(
      cart.map((i) =>
        i.productId === productId
          ? {
              ...i,
              quantite: newQty,
              total_ligne: newQty * i.prix_vente,
            }
          : i
      )
    );
  };

  // Remove item
  const removeFromCart = (productId: number) => {
    setCart(cart.filter((i) => i.productId !== productId));
    playBeep(450, 'sine', 0.05);
  };

  // Clear cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setMontantRecu('');
    barcodeInputRef.current?.focus();
    showToast('Panier vidé.', 'warning');
  };

  // Handle barcode submission (hardware scanner or manual enter)
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    // 1. Direct barcode exact match
    const exactMatch = products.find(
      (p) => p.code_barre.toLowerCase() === query.toLowerCase()
    );

    if (exactMatch) {
      addProductToCart(exactMatch, 1);
      setBarcodeInput('');
      setShowMatchesDropdown(false);
      return;
    }

    // 2. If dropdown is active and has selection
    if (showMatchesDropdown && searchMatches.length > 0) {
      const selected = searchMatches[selectedMatchIndex] || searchMatches[0];
      if (selected) {
        addProductToCart(selected, 1);
        setBarcodeInput('');
        setShowMatchesDropdown(false);
        return;
      }
    }

    // 3. Single partial match fallback
    const partials = products.filter(
      (p) =>
        p.nom.toLowerCase().includes(query.toLowerCase()) ||
        p.code_barre.toLowerCase().includes(query.toLowerCase())
    );

    if (partials.length === 1) {
      addProductToCart(partials[0], 1);
      setBarcodeInput('');
      setShowMatchesDropdown(false);
    } else if (partials.length > 1) {
      setSearchMatches(partials);
      setShowMatchesDropdown(true);
      setSelectedMatchIndex(0);
    } else {
      playBeep(250, 'sawtooth', 0.2);
      showToast(`Aucun article trouvé pour "${query}".`, 'error');
    }
  };

  // Validate Retail Sale (Atomic checkout transaction)
  const handleValidateSale = async () => {
    if (cart.length === 0) {
      showToast('Le panier est vide.', 'warning');
      barcodeInputRef.current?.focus();
      return;
    }

    if (!isPaymentSufficient) {
      playBeep(300, 'sawtooth', 0.2);
      showToast(`Paiement insuffisant ! Manque encore ${montantManquant.toLocaleString()} DA.`, 'error');
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.productId,
          quantite: item.quantite,
          prix_achat: item.prix_achat,
          prix_vente: item.prix_vente,
          total_ligne: item.total_ligne,
        })),
        totalHt: totalAPayer,
        montantVerse: montantRecuNum,
      };

      // @ts-ignore
      const res = await window.api.createRetailSale(payload);

      if (res && res.success) {
        // Audio celebration
        playBeep(587, 'triangle', 0.08);
        setTimeout(() => playBeep(880, 'triangle', 0.15), 90);

        const renderedChange = monnaieARendre > 0
          ? ` | Monnaie rendue : ${monnaieARendre.toLocaleString()} DA`
          : '';
        showToast(`Vente #${String(res.saleId).padStart(4, '0')} encaissée avec succès !${renderedChange}`, 'success');

        // Prepare receipt data
        const receipt: ReceiptData = {
          saleId: res.saleId,
          type_vente: 'DETAIL',
          items: cart.map((i) => ({
            nom: i.nom,
            code_barre: i.code_barre,
            quantite: i.quantite,
            prix_vente: i.prix_vente,
            total_ligne: i.total_ligne,
          })),
          total_ht: totalAPayer,
          montant_verse: montantRecuNum,
          monnaie_rendue: monnaieARendre,
          date: new Date().toISOString(),
        };

        setLastReceiptData(receipt);

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

        // Reset state immediately for the next customer
        setCart([]);
        setMontantRecu('');
        setBarcodeInput('');
        setShowMatchesDropdown(false);

        // Refresh stock levels in background
        fetchProducts();

        // Keep scanner focused for continuous fast scanning
        setTimeout(() => {
          barcodeInputRef.current?.focus();
        }, 50);
      } else {
        showToast(res?.error || 'Échec de la validation de la vente.', 'error');
      }
    } catch (err: any) {
      console.error('Retail sale error:', err);
      showToast(`Erreur: ${err.message || 'Échec transaction'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview ticket manually (before or after sale, always opens modal)
  const handlePreviewTicket = () => {
    try {
      const itemsToUse = cart.length > 0 
        ? cart.map((i) => ({
            nom: i.nom || 'Article',
            code_barre: i.code_barre || '',
            quantite: Number(i.quantite) || 1,
            prix_vente: Number(i.prix_vente) || 0,
            total_ligne: Number(i.total_ligne) || ((Number(i.quantite) || 1) * (Number(i.prix_vente) || 0)),
          }))
        : (lastReceiptData?.items || []);

      const totalHt = cart.length > 0 ? totalAPayer : (lastReceiptData?.total_ht || 0);
      const vers = cart.length > 0 
        ? (montantRecuNum > 0 ? montantRecuNum : totalAPayer) 
        : (lastReceiptData?.montant_verse || 0);
      const monnaie = cart.length > 0 ? monnaieARendre : (lastReceiptData?.monnaie_rendue || 0);

      const previewData: ReceiptData = {
        saleId: lastReceiptData ? lastReceiptData.saleId : 1,
        type_vente: 'DETAIL',
        items: itemsToUse,
        total_ht: totalHt,
        montant_verse: vers,
        monnaie_rendue: monnaie,
        client: undefined,
        date: new Date().toISOString(),
      };

      setCurrentReceiptData(previewData);
      setReceiptModalOpen(true);
    } catch (err: any) {
      console.error('Error opening retail receipt preview:', err);
      setCurrentReceiptData({
        saleId: 1,
        type_vente: 'DETAIL',
        items: [],
        total_ht: 0,
        montant_verse: 0,
        client: undefined,
        date: new Date().toISOString(),
      });
      setReceiptModalOpen(true);
    }
  };

  // Global & Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 -> Validate Sale
      if (e.key === 'F12') {
        e.preventDefault();
        handleValidateSale();
      }
      // Escape -> Clear Cart
      else if (e.key === 'Escape') {
        if (showMatchesDropdown) {
          setShowMatchesDropdown(false);
        } else if (cart.length > 0) {
          e.preventDefault();
          handleClearCart();
        }
      }
      // F10 -> Quick toggle catalog
      else if (e.key === 'F10') {
        e.preventDefault();
        setShowCatalog((prev) => !prev);
      }
      // Enter on cash input -> Validate Sale
      else if (e.key === 'Enter' && document.activeElement === cashInputRef.current) {
        e.preventDefault();
        handleValidateSale();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isPaymentSufficient, totalAPayer, montantRecuNum, monnaieARendre, showMatchesDropdown]);

  // Handle dropdown navigation with keyboard arrows
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMatchesDropdown && searchMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMatchIndex((prev) => (prev + 1) % searchMatches.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleBarcodeSubmit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }
    } else if (e.key === 'Tab' && cart.length > 0) {
      e.preventDefault();
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }
  };

  const formatMoney = (val: number) => {
    return (val || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DA';
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100 text-slate-800">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-14 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl border flex items-center gap-3 animate-fade-in text-sm font-bold ${
            toastMessage.type === 'success'
              ? 'bg-slate-900 text-white border-slate-700'
              : toastMessage.type === 'warning'
              ? 'bg-amber-900 text-white border-amber-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          <span className="text-lg">
            {toastMessage.type === 'success' ? '✓' : toastMessage.type === 'warning' ? '⚠️' : '✕'}
          </span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LEFT SECTION (65%): Cart & Product Scanning/Search                    */}
      {/* ===================================================================== */}
      <div className="flex-[65] flex flex-col h-full border-r border-slate-200 overflow-hidden bg-white">
        {/* Module Header Bar */}
        <div className="bg-slate-900 text-white px-4 py-2 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-base p-1 bg-blue-600 rounded-lg">⚡</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight text-white">Vente au Détail</h1>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Client Passager • Prix Détail
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Encaissement comptant express • Raccourcis: <kbd className="font-mono text-slate-300">[F12]</kbd> Encaisser | <kbd className="font-mono text-slate-300">[Échap]</kbd> Vider | <kbd className="font-mono text-slate-300">[Tab]</kbd> Espèces
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePreviewTicket}
              title="Aperçu ou réimpression du ticket de caisse"
              className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
            >
              <span>🧾</span>
              <span>Aperçu Ticket</span>
            </button>

            {/* Catalog Toggle Button */}
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                showCatalog
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              <span>📦</span>
              <span>{showCatalog ? 'Masquer' : 'Catalogue'}</span>
              <kbd className="text-[10px] bg-black/40 px-1 py-0.2 rounded font-mono">F10</kbd>
            </button>
          </div>
        </div>

        {/* High-Visibility Barcode Scanner & Search Input Field */}
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <form onSubmit={handleBarcodeSubmit} className="relative">
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm text-slate-400 pointer-events-none">
                🏷️
              </span>
              <input
                ref={barcodeInputRef}
                type="text"
                autoFocus
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Scanner un code-barres (douchette) ou saisir le nom du produit..."
                className="w-full pl-9 pr-24 py-1.5 bg-white border border-slate-300 focus:border-blue-600 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-none transition-all"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-md shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Ajouter</span>
                <kbd className="text-[10px] bg-blue-800/60 px-1 py-0.2 rounded font-mono">↵</kbd>
              </button>
            </div>

            {/* Instant Search Suggestions Dropdown */}
            {showMatchesDropdown && searchMatches.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-auto animate-scale-up">
                <div className="bg-slate-50 px-4 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                  <span>Résultats correspondants ({searchMatches.length})</span>
                  <span>Utilisez ↑ / ↓ puis Entrée</span>
                </div>
                {searchMatches.map((match, idx) => (
                  <div
                    key={match.id}
                    onClick={() => {
                      addProductToCart(match, 1);
                      setBarcodeInput('');
                      setShowMatchesDropdown(false);
                      barcodeInputRef.current?.focus();
                    }}
                    className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                      idx === selectedMatchIndex ? 'bg-blue-50/80 text-blue-900 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{match.nom}</p>
                      <p className="text-xs text-slate-400 font-mono">{match.code_barre}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black font-mono text-emerald-700">
                        {formatMoney(match.prix_detail)}
                      </p>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          match.stock_actuel <= 0
                            ? 'bg-rose-100 text-rose-700'
                            : match.stock_actuel <= match.seuil_alerte
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        Stock: {match.stock_actuel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Live Product Quick-Pick Catalog Panel (Optional / Toggleable) */}
        {showCatalog && (
          <div className="bg-slate-50/80 border-b border-slate-200 p-4 shrink-0 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>📦</span> Catalogue Rapide Détail
              </span>
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Filtrer catalogue..."
                className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div
              ref={catalogListRef}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-auto pr-1"
            >
              {filteredCatalog.map((prod) => {
                const isOutOfStock = prod.stock_actuel <= 0;
                return (
                  <button
                    key={prod.id}
                    disabled={isOutOfStock}
                    onClick={() => {
                      addProductToCart(prod, 1);
                      barcodeInputRef.current?.focus();
                    }}
                    className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      isOutOfStock
                        ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                        : 'bg-white hover:bg-blue-50 hover:border-blue-300 border-slate-200 cursor-pointer shadow-2xs hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800 truncate" title={prod.nom}>
                        {prod.nom}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{prod.code_barre}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                      <span className="text-xs font-black font-mono text-emerald-700">
                        {prod.prix_detail} DA
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1 rounded ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isOutOfStock ? 'Rupture' : `${prod.stock_actuel} dispo`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Cart Items Table */}
        <div className="flex-1 overflow-auto flex flex-col">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 select-none">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-4xl mb-4 text-slate-300">
                🛒
              </div>
              <p className="text-base font-bold text-slate-700">Prêt pour le prochain client</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                Scannez le code-barres d'un article avec la douchette ou saisissez son nom pour l'ajouter au panier de détail.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 select-none">
                <tr>
                  <th className="py-2 px-3">Code-barre</th>
                  <th className="py-2 px-3">Désignation</th>
                  <th className="py-2 px-3 text-right">Prix Détail</th>
                  <th className="py-2 px-3 text-center">Quantité</th>
                  <th className="py-2 px-3 text-right">Total Ligne</th>
                  <th className="py-2 px-3 text-center">Suppr.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                    {/* Barcode */}
                    <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">
                      {item.code_barre}
                    </td>

                    {/* Name */}
                    <td className="py-1.5 px-3">
                      <p className="font-bold text-slate-900 text-xs">{item.nom}</p>
                      <span className="text-[10px] text-slate-400">
                        Dispo : {item.stock_actuel} u
                      </span>
                    </td>

                    {/* Retail Unit Price */}
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-700">
                      {formatMoney(item.prix_vente)}
                    </td>

                    {/* Quantity controls */}
                    <td className="py-1.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.productId, item.quantite - 1)}
                          className="w-5 h-5 rounded bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shadow-2xs cursor-pointer transition-colors"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.stock_actuel}
                          value={item.quantite}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                              updateItemQuantity(item.productId, val);
                            }
                          }}
                          className="w-10 text-center bg-white font-mono font-bold text-xs py-0.2 rounded border border-slate-200 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={item.quantite >= item.stock_actuel}
                          onClick={() => updateItemQuantity(item.productId, item.quantite + 1)}
                          className="w-5 h-5 rounded bg-white hover:bg-slate-200 disabled:opacity-40 text-slate-700 flex items-center justify-center font-bold text-xs shadow-2xs cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Total Line */}
                    <td className="py-1.5 px-3 text-right font-mono font-black text-blue-700 text-xs">
                      {formatMoney(item.total_ligne)}
                    </td>

                    {/* Delete button */}
                    <td className="py-1.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId)}
                        title="Supprimer la ligne"
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Cart Status Toolbar */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-1.5 shrink-0 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Articles : <strong className="text-slate-800 font-mono">{cart.length}</strong>
            </span>
            <span>
              Total unités :{' '}
              <strong className="text-slate-800 font-mono">
                {cart.reduce((sum, item) => sum + item.quantite, 0)}
              </strong>
            </span>
          </div>

          {cart.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Vider le panier</span>
              <kbd className="text-[10px] bg-slate-200 px-1 py-0.2 rounded text-slate-600 font-mono">Échap</kbd>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* RIGHT SECTION (35%): Cashier Settlement & Change Calculation Panel    */}
      {/* ===================================================================== */}
      <div className="flex-[35] flex flex-col h-full bg-slate-900 text-white p-3.5 shadow-xl overflow-auto justify-between">
        <div className="space-y-2.5">
          {/* Panel Title */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">💵</span>
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Règlement Caisse
                </h2>
                <p className="text-[10px] text-slate-400">Paiement au comptant immédiat</p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded">
              Comptant Uniquement
            </span>
          </div>

          {/* TOTAL À PAYER Display */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 shadow-inner">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              TOTAL À PAYER
            </p>
            <p className="text-2xl font-black font-mono text-amber-400 mt-0.5 tracking-tight">
              {formatMoney(totalAPayer)}
            </p>
          </div>

          {/* Montant Reçu (Cash input) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex justify-between">
              <span>Montant Reçu (Espèces) *</span>
              <span className="text-slate-400 lowercase font-mono text-[10px]">[Tab]</span>
            </label>
            <div className="relative">
              <input
                ref={cashInputRef}
                type="number"
                step="any"
                disabled={cart.length === 0}
                value={montantRecu}
                onChange={(e) => setMontantRecu(e.target.value)}
                placeholder="0.00"
                className="w-full pl-3 pr-12 py-2 bg-slate-800 border-2 border-slate-700 focus:border-emerald-500 focus:bg-slate-800/90 rounded-lg text-xl font-mono font-black text-white focus:outline-none transition-all disabled:opacity-40"
              />
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center font-bold text-slate-400 text-xs">
                DA
              </span>
            </div>

            {/* Quick Denominations presets */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => {
                  setMontantRecu(String(totalAPayer));
                  playBeep(700, 'sine', 0.05);
                }}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-bold rounded shadow-2xs transition-all cursor-pointer"
              >
                Exact ({totalAPayer.toLocaleString()} DA)
              </button>

              {[200, 500, 1000, 2000, 5000].map((denomination) => (
                <button
                  key={denomination}
                  type="button"
                  disabled={cart.length === 0}
                  onClick={() => {
                    const current = Number(montantRecu) || 0;
                    setMontantRecu(String(current + denomination));
                    playBeep(750, 'sine', 0.04);
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-mono font-bold rounded transition-all cursor-pointer"
                >
                  +{denomination.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Monnaie à Rendre (Change) Calculation */}
          <div className="space-y-1.5">
            <div
              className={`rounded-lg p-2.5 border transition-all ${
                monnaieARendre > 0
                  ? 'bg-emerald-950/40 border-emerald-600/50 shadow-sm shadow-emerald-950/30'
                  : 'bg-slate-800/40 border-slate-700/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Monnaie à Rendre
                  </p>
                  <p
                    className={`text-xl font-black font-mono mt-0.5 ${
                      monnaieARendre > 0 ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {formatMoney(monnaieARendre)}
                  </p>
                </div>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-base font-bold ${
                    monnaieARendre > 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-700 text-slate-500'
                  }`}
                >
                  🪙
                </div>
              </div>
            </div>

            {/* Visual Indicator blocking validation if insufficient cash */}
            {cart.length > 0 && montantRecuNum > 0 && !isPaymentSufficient && (
              <div className="bg-rose-950/50 border border-rose-800/60 rounded-lg p-2 text-xs text-rose-300 animate-fade-in flex items-start gap-1.5">
                <span className="text-rose-400 font-bold text-sm">⚠️</span>
                <div>
                  <p className="font-bold text-[11px]">
                    Insuffisant ! Reste à percevoir :{' '}
                    <span className="font-mono text-rose-200 font-black">
                      {formatMoney(montantManquant)}
                    </span>
                  </p>
                  <p className="text-[10px] text-rose-400">
                    Crédit non autorisé en vente au détail.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Checkout Action Button */}
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <button
            type="button"
            disabled={!isPaymentSufficient || isSubmitting || cart.length === 0}
            onClick={handleValidateSale}
            className={`w-full py-2.5 rounded-xl font-black text-xs tracking-wide transition-all shadow-lg flex items-center justify-center gap-1.5 select-none ${
              isPaymentSufficient && cart.length > 0 && !isSubmitting
                ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-900/50 hover:shadow-emerald-900/80 cursor-pointer animate-pulse-subtle'
                : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Enregistrement...</span>
              </>
            ) : cart.length === 0 ? (
              <span>Panier Vide</span>
            ) : !isPaymentSufficient ? (
              <span>En attente ({formatMoney(totalAPayer)})</span>
            ) : (
              <>
                <span className="text-sm">✓</span>
                <span>Valider l'Encaissement</span>
                <kbd className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded font-mono font-normal">
                  [F12]
                </kbd>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePreviewTicket}
            className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>🧾</span>
            <span>Aperçu / Imprimer Ticket</span>
          </button>

          <p className="text-[10px] text-center text-slate-500">
            Mise à jour immédiate du stock • Sortie de caisse automatique
          </p>
        </div>
      </div>

      {/* Thermal Receipt Preview & Printing Engine Modal */}
      <ReceiptPreviewModal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          barcodeInputRef.current?.focus();
        }}
        receiptData={currentReceiptData}
        onPrinted={() => {
          barcodeInputRef.current?.focus();
        }}
      />
    </div>
  );
};
