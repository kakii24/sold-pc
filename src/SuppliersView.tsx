import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  useAppStore,
  type Supplier,
  type SupplierProduct,
  type SupplierInvoice,
  type SupplierLedgerRecord,
} from './store';

export const SuppliersView: React.FC = () => {
  const {
    suppliers,
    fetchSuppliers,
    addSupplier,
    editSupplier,
    removeSupplier,
    fetchSupplierProducts,
    addSupplierProduct,
    editSupplierProduct,
    removeSupplierProduct,
    fetchSupplierInvoices,
    fetchSupplierLedger,
    createSupplierInvoice,
    paySupplierDebt,
  } = useAppStore();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'debtors' | 'cleared'>('all');

  // Selected Supplier for Detail / Profile
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'invoices' | 'ledger'>('products');

  // Supplier Detail Data
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [supplierLedger, setSupplierLedger] = useState<SupplierLedgerRecord[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Modals state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Forms State - Supplier
  const [supplierForm, setSupplierForm] = useState({
    nom: '',
    nom_societe: '',
    telephone: '',
    adresse: '',
    total_dette: '',
  });

  // Forms State - Product Bought From Supplier
  const [productForm, setProductForm] = useState({
    nom: '',
    reference: '',
    prix_achat: '',
    categorie: '',
    notes: '',
  });

  // Forms State - Supply Invoice
  const [invoiceForm, setInvoiceForm] = useState({
    reference_facture: '',
    description: '',
    montant_total: '',
    montant_paye: '',
  });

  // Forms State - Debt Payment
  const [paymentForm, setPaymentForm] = useState({
    montant: '',
    description: '',
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const supplierNameRef = useRef<HTMLInputElement>(null);
  const productNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Load details whenever selected supplier changes
  useEffect(() => {
    if (!selectedSupplier) {
      setSupplierProducts([]);
      setSupplierInvoices([]);
      setSupplierLedger([]);
      return;
    }

    const loadSupplierData = async () => {
      setIsLoadingDetails(true);
      try {
        const [prods, invs, ledg] = await Promise.all([
          fetchSupplierProducts(selectedSupplier.id),
          fetchSupplierInvoices(selectedSupplier.id),
          fetchSupplierLedger(selectedSupplier.id),
        ]);
        setSupplierProducts(prods);
        setSupplierInvoices(invs);
        setSupplierLedger(ledg);
      } catch (err) {
        console.error('Error loading supplier details:', err);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    loadSupplierData();
  }, [selectedSupplier, fetchSupplierProducts, fetchSupplierInvoices, fetchSupplierLedger]);

  // Keep selectedSupplier updated when suppliers state updates
  useEffect(() => {
    if (selectedSupplier) {
      const refreshed = suppliers.find((s) => s.id === selectedSupplier.id);
      if (refreshed) {
        setSelectedSupplier(refreshed);
      }
    }
  }, [suppliers]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Insert' && !isSupplierModalOpen && !isProductModalOpen && !isInvoiceModalOpen && !isPaymentModalOpen) {
        e.preventDefault();
        handleOpenAddSupplier();
      } else if (e.key === 'Escape') {
        if (isProductModalOpen) setIsProductModalOpen(false);
        else if (isInvoiceModalOpen) setIsInvoiceModalOpen(false);
        else if (isPaymentModalOpen) setIsPaymentModalOpen(false);
        else if (isSupplierModalOpen) setIsSupplierModalOpen(false);
        else if (selectedSupplier) setSelectedSupplier(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSupplierModalOpen, isProductModalOpen, isInvoiceModalOpen, isPaymentModalOpen, selectedSupplier]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      // Status filter
      if (statusFilter === 'debtors' && (s.total_dette || 0) <= 0) return false;
      if (statusFilter === 'cleared' && (s.total_dette || 0) > 0) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.nom.toLowerCase().includes(q);
        const matchSociete = (s.nom_societe || '').toLowerCase().includes(q);
        const matchPhone = (s.telephone || '').toLowerCase().includes(q);
        const matchAddress = (s.adresse || '').toLowerCase().includes(q);
        return matchName || matchSociete || matchPhone || matchAddress;
      }

      return true;
    });
  }, [suppliers, statusFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const totalCount = suppliers.length;
    const totalDette = suppliers.reduce((acc, s) => acc + (Number(s.total_dette) || 0), 0);
    const debtorsCount = suppliers.filter((s) => (s.total_dette || 0) > 0).length;
    return { totalCount, totalDette, debtorsCount };
  }, [suppliers]);

  // Supplier Add/Edit Handlers
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      nom: '',
      nom_societe: '',
      telephone: '',
      adresse: '',
      total_dette: '0',
    });
    setFormError('');
    setIsSupplierModalOpen(true);
    setTimeout(() => supplierNameRef.current?.focus(), 100);
  };

  const handleOpenEditSupplier = (supplier: Supplier, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingSupplier(supplier);
    setSupplierForm({
      nom: supplier.nom,
      nom_societe: supplier.nom_societe || '',
      telephone: supplier.telephone || '',
      adresse: supplier.adresse || '',
      total_dette: (supplier.total_dette || 0).toString(),
    });
    setFormError('');
    setIsSupplierModalOpen(true);
    setTimeout(() => supplierNameRef.current?.focus(), 100);
  };

  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.nom.trim()) {
      setFormError('Le nom du fournisseur est obligatoire.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingSupplier) {
        await editSupplier({
          id: editingSupplier.id,
          nom: supplierForm.nom.trim(),
          nom_societe: supplierForm.nom_societe.trim(),
          telephone: supplierForm.telephone.trim(),
          adresse: supplierForm.adresse.trim(),
        });
        showToast(`✅ Fournisseur "${supplierForm.nom}" modifié avec succès.`);
      } else {
        const created = await addSupplier({
          nom: supplierForm.nom.trim(),
          nom_societe: supplierForm.nom_societe.trim(),
          telephone: supplierForm.telephone.trim(),
          adresse: supplierForm.adresse.trim(),
          total_dette: parseFloat(supplierForm.total_dette) || 0,
        });
        showToast(`✅ Fournisseur "${supplierForm.nom}" créé avec succès.`);
        setSelectedSupplier(created);
      }
      setIsSupplierModalOpen(false);
    } catch (err: any) {
      console.error('Erreur sauvegarde fournisseur:', err);
      setFormError(err.message || 'Erreur lors de la sauvegarde du fournisseur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const confirmMsg = `Confirmez-vous la suppression définitive du fournisseur :\n\n"${supplier.nom}" (${supplier.nom_societe || 'Sans société'}) ?\n\nTous ses produits associés et son historique seront supprimés.`;
    if (window.confirm(confirmMsg)) {
      try {
        await removeSupplier(supplier.id);
        if (selectedSupplier?.id === supplier.id) {
          setSelectedSupplier(null);
        }
        showToast(`🗑️ Fournisseur "${supplier.nom}" supprimé.`);
      } catch (err: any) {
        console.error('Erreur suppression fournisseur:', err);
        alert('Erreur suppression fournisseur: ' + err.message);
      }
    }
  };

  // Supplier Product Handlers
  const handleOpenAddProduct = () => {
    if (!selectedSupplier) return;
    setEditingProduct(null);
    setProductForm({
      nom: '',
      reference: '',
      prix_achat: '',
      categorie: '',
      notes: '',
    });
    setFormError('');
    setIsProductModalOpen(true);
    setTimeout(() => productNameRef.current?.focus(), 100);
  };

  const handleOpenEditProduct = (prod: SupplierProduct) => {
    setEditingProduct(prod);
    setProductForm({
      nom: prod.nom,
      reference: prod.reference || '',
      prix_achat: prod.prix_achat.toString(),
      categorie: prod.categorie || '',
      notes: prod.notes || '',
    });
    setFormError('');
    setIsProductModalOpen(true);
    setTimeout(() => productNameRef.current?.focus(), 100);
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    if (!productForm.nom.trim()) {
      setFormError('Le nom du produit acheté est obligatoire.');
      return;
    }
    const prix = parseFloat(productForm.prix_achat);
    if (isNaN(prix) || prix < 0) {
      setFormError('Veuillez saisir un prix d’achat valide.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingProduct) {
        const updated = await editSupplierProduct({
          id: editingProduct.id,
          supplier_id: selectedSupplier.id,
          nom: productForm.nom.trim(),
          reference: productForm.reference.trim() || undefined,
          prix_achat: prix,
          categorie: productForm.categorie.trim() || undefined,
          notes: productForm.notes.trim() || undefined,
        });
        setSupplierProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        showToast(`✅ Produit "${updated.nom}" mis à jour.`);
      } else {
        const created = await addSupplierProduct({
          supplier_id: selectedSupplier.id,
          nom: productForm.nom.trim(),
          reference: productForm.reference.trim() || undefined,
          prix_achat: prix,
          categorie: productForm.categorie.trim() || undefined,
          notes: productForm.notes.trim() || undefined,
        });
        setSupplierProducts((prev) => [created, ...prev]);
        showToast(`✅ Produit "${created.nom}" ajouté au fournisseur.`);
      }
      setIsProductModalOpen(false);
    } catch (err: any) {
      console.error('Erreur sauvegarde produit fournisseur:', err);
      setFormError(err.message || 'Erreur lors de l’enregistrement du produit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (prod: SupplierProduct) => {
    if (window.confirm(`Supprimer le produit "${prod.nom}" de ce fournisseur ?`)) {
      try {
        await removeSupplierProduct(prod.id);
        setSupplierProducts((prev) => prev.filter((p) => p.id !== prod.id));
        showToast(`🗑️ Produit supprimé de la liste.`);
      } catch (err: any) {
        console.error('Erreur suppression produit fournisseur:', err);
        alert('Erreur suppression produit: ' + err.message);
      }
    }
  };

  // Supply Invoice Handler
  const handleOpenAddInvoice = () => {
    if (!selectedSupplier) return;
    setInvoiceForm({
      reference_facture: '',
      description: 'Facture / Approvisionnement marchandises',
      montant_total: '',
      montant_paye: '',
    });
    setFormError('');
    setIsInvoiceModalOpen(true);
  };

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    const total = parseFloat(invoiceForm.montant_total);
    const paye = parseFloat(invoiceForm.montant_paye) || 0;

    if (isNaN(total) || total <= 0) {
      setFormError('Le montant total doit être supérieur à 0.');
      return;
    }
    if (paye < 0) {
      setFormError('Le montant payé ne peut pas être négatif.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const res = await createSupplierInvoice({
        supplierId: selectedSupplier.id,
        reference_facture: invoiceForm.reference_facture.trim(),
        description: invoiceForm.description.trim(),
        montant_total: total,
        montant_paye: paye,
      });

      if (res.success) {
        showToast(`✅ Facture d’achat enregistrée avec succès.`);
        setIsInvoiceModalOpen(false);
        // Refresh details
        const [invs, ledg] = await Promise.all([
          fetchSupplierInvoices(selectedSupplier.id),
          fetchSupplierLedger(selectedSupplier.id),
        ]);
        setSupplierInvoices(invs);
        setSupplierLedger(ledg);
      } else {
        setFormError(res.error || 'Erreur enregistrement facture.');
      }
    } catch (err: any) {
      console.error('Erreur enregistrement facture achat:', err);
      setFormError(err.message || 'Erreur enregistrement facture.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Debt Payment Handler
  const handleOpenAddPayment = () => {
    if (!selectedSupplier) return;
    setPaymentForm({
      montant: '',
      description: 'Versement / Règlement dette fournisseur',
    });
    setFormError('');
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    const montant = parseFloat(paymentForm.montant);

    if (isNaN(montant) || montant <= 0) {
      setFormError('Veuillez saisir un montant de règlement valide.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const res = await paySupplierDebt(
        selectedSupplier.id,
        montant,
        paymentForm.description.trim() || undefined
      );

      if (res.success) {
        showToast(`✅ Règlement de ${montant.toLocaleString('fr-FR')} DA enregistré.`);
        setIsPaymentModalOpen(false);
        // Refresh ledger
        const ledg = await fetchSupplierLedger(selectedSupplier.id);
        setSupplierLedger(ledg);
      } else {
        setFormError(res.error || 'Erreur versement dette.');
      }
    } catch (err: any) {
      console.error('Erreur règlement dette fournisseur:', err);
      setFormError(err.message || 'Erreur règlement dette.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden bg-gray-100 w-full h-full select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-5 z-50 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl border border-gray-700 flex items-center gap-2 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Metrics Bar */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span>🏭</span>
            <span>Les Fournisseurs & Approvisionnements</span>
            <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
              Achats & Dettes
            </span>
          </h1>
          <p className="text-xs text-gray-500">
            Gestion du carnet de fournisseurs, liste des articles achetés, coordonnées complètes et suivi des dettes d'achats.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddSupplier}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            title="Ajouter un nouveau fournisseur (Raccourci: Touche Ins)"
          >
            <span className="text-base font-black">+</span>
            <span>Nouveau Fournisseur</span>
            <kbd className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded font-mono text-indigo-100">Ins</kbd>
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-3 gap-3 mb-3 shrink-0">
        {/* Card 1: TOTAL FOURNISSEURS */}
        <div className="bg-white rounded-xl p-3.5 shadow-xs border border-gray-200 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-gray-500 font-bold block mb-1">
              🏢 Total Fournisseurs
            </span>
            <div className="text-2xl font-black text-gray-900 font-mono">
              {metrics.totalCount}
            </div>
            <span className="text-[11px] text-gray-400">Entreprises & distributeurs enregistrés</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl">
            🤝
          </div>
        </div>

        {/* Card 2: DETTE TOTALE ENVERS LES FOURNISSEURS */}
        <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-xl p-3.5 shadow-md border border-indigo-800 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-indigo-200 font-bold block mb-1 flex items-center gap-1.5">
              <span>💳</span>
              <span>Dettes Achats en Cours</span>
            </span>
            <div className="text-2xl font-black text-white font-mono flex items-baseline gap-1.5">
              <span>{metrics.totalDette.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs font-bold text-indigo-300">DA</span>
            </div>
            <span className="text-[11px] text-indigo-300">
              {metrics.debtorsCount} fournisseur(s) avec créances à régler
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl">
            ⏳
          </div>
        </div>

        {/* Card 3: FOURNISSEURS RÉGLÉS */}
        <div className="bg-white rounded-xl p-3.5 shadow-xs border border-gray-200 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-gray-500 font-bold block mb-1">
              ✅ Comptes Sans Dette
            </span>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              {metrics.totalCount - metrics.debtorsCount}
            </div>
            <span className="text-[11px] text-gray-400">Soldes à jour (0.00 DA de dette)</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xl">
            ✨
          </div>
        </div>
      </div>

      {/* MAIN CONTENT: 2-COLUMN SPLIT (SUPPLIERS LIST & SELECTED SUPPLIER PROFILE) */}
      <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
        {/* LEFT COLUMN: LIST OF SUPPLIERS (Col-span 5 or 12 if none selected) */}
        <div className={`${selectedSupplier ? 'col-span-5' : 'col-span-12'} bg-white rounded-xl border border-gray-200 shadow-xs flex flex-col overflow-hidden`}>
          {/* Search & Filter Header */}
          <div className="p-2.5 border-b border-gray-200 bg-gray-50 flex flex-col gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, société, téléphone, ville..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center justify-between">
              <div className="flex items-center bg-gray-200/70 p-0.5 rounded-lg border border-gray-300">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tous ({suppliers.length})
                </button>
                <button
                  onClick={() => setStatusFilter('debtors')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    statusFilter === 'debtors' ? 'bg-white text-rose-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Dettes ({metrics.debtorsCount})
                </button>
                <button
                  onClick={() => setStatusFilter('cleared')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    statusFilter === 'cleared' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  À jour
                </button>
              </div>

              <span className="text-[11px] text-gray-500 font-medium">
                {filteredSuppliers.length} affiché(s)
              </span>
            </div>
          </div>

          {/* Suppliers List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredSuppliers.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                <span className="text-3xl mb-2">🏭</span>
                <p className="font-bold text-gray-700 text-xs">Aucun fournisseur trouvé</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {suppliers.length === 0
                    ? 'Cliquez sur "Nouveau Fournisseur" pour ajouter votre premier partenaire d\'approvisionnement.'
                    : 'Aucun résultat ne correspond à votre recherche.'}
                </p>
                <button
                  onClick={handleOpenAddSupplier}
                  className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  + Ajouter un fournisseur
                </button>
              </div>
            ) : (
              filteredSuppliers.map((supplier) => {
                const isSelected = selectedSupplier?.id === supplier.id;
                const dette = Number(supplier.total_dette) || 0;
                return (
                  <div
                    key={supplier.id}
                    onClick={() => setSelectedSupplier(supplier)}
                    className={`p-3 transition-colors cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-xs text-gray-900 truncate">
                          {supplier.nom}
                        </span>
                        {supplier.nom_societe && (
                          <span className="px-1.5 py-0.2 text-[10px] bg-gray-100 text-gray-600 rounded font-medium truncate max-w-[120px]">
                            {supplier.nom_societe}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-gray-500 truncate">
                        {supplier.telephone ? (
                          <span className="flex items-center gap-1 font-mono">
                            <span>📞</span>
                            <span>{supplier.telephone}</span>
                          </span>
                        ) : (
                          <span className="italic text-gray-400">Sans téléphone</span>
                        )}
                        {supplier.adresse && (
                          <span className="flex items-center gap-1 truncate text-gray-400">
                            <span>📍</span>
                            <span className="truncate">{supplier.adresse}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side: Debt Badge & Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block uppercase font-mono">
                          Dette
                        </span>
                        {dette > 0 ? (
                          <span className="font-mono font-black text-rose-600 text-xs">
                            {dette.toLocaleString('fr-FR')} DA
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-emerald-600 text-[11px]">
                            0.00 DA
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                        <button
                          onClick={(e) => handleOpenEditSupplier(supplier, e)}
                          className="p-1 hover:bg-gray-200 text-gray-600 hover:text-blue-600 rounded transition-all cursor-pointer"
                          title="Modifier les coordonnées du fournisseur"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => handleDeleteSupplier(supplier, e)}
                          className="p-1 hover:bg-rose-100 text-gray-600 hover:text-rose-600 rounded transition-all cursor-pointer"
                          title="Supprimer ce fournisseur"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SELECTED SUPPLIER PROFILE & PRODUCTS (Col-span 7) */}
        {selectedSupplier ? (
          <div className="col-span-7 bg-white rounded-xl border border-gray-200 shadow-xs flex flex-col overflow-hidden animate-in fade-in duration-150">
            {/* Header: Supplier Identity & Contact Info */}
            <div className="bg-gradient-to-r from-gray-900 to-indigo-950 text-white p-3.5 shrink-0 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🏢</span>
                  <h2 className="text-base font-black tracking-wide text-white">
                    {selectedSupplier.nom}
                  </h2>
                  {selectedSupplier.nom_societe && (
                    <span className="text-xs bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-2 py-0.5 rounded-md font-semibold">
                      {selectedSupplier.nom_societe}
                    </span>
                  )}
                </div>

                {/* Details: Phone & Address */}
                <div className="flex items-center gap-4 text-xs text-gray-300 mt-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">📞 Téléphone :</span>
                    <strong className="font-mono text-white select-all">
                      {selectedSupplier.telephone || 'Non renseigné'}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">📍 Adresse :</span>
                    <strong className="text-white">
                      {selectedSupplier.adresse || 'Non renseignée'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Debt & Quick Actions */}
              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold block">
                  Solde Dette Actuelle
                </span>
                <div className="text-lg font-black font-mono text-rose-300">
                  {Number(selectedSupplier.total_dette || 0).toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  DA
                </div>
                {Number(selectedSupplier.total_dette || 0) > 0 && (
                  <button
                    onClick={handleOpenAddPayment}
                    className="mt-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-md shadow-xs transition-all cursor-pointer"
                  >
                    💰 Régler dette
                  </button>
                )}
              </div>
            </div>

            {/* Navigation Tabs for Profile */}
            <div className="bg-gray-100 border-b border-gray-200 px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('products')}
                  className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'products'
                      ? 'border-indigo-600 text-indigo-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span>📦</span>
                  <span>Articles & Produits Achetés</span>
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-gray-200 rounded-full font-mono">
                    {supplierProducts.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('invoices')}
                  className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'invoices'
                      ? 'border-indigo-600 text-indigo-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span>🧾</span>
                  <span>Factures & Bons de Livraison</span>
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-gray-200 rounded-full font-mono">
                    {supplierInvoices.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('ledger')}
                  className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'ledger'
                      ? 'border-indigo-600 text-indigo-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span>📒</span>
                  <span>Grand Livre & Paiements</span>
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-gray-200 rounded-full font-mono">
                    {supplierLedger.length}
                  </span>
                </button>
              </div>

              {/* Tab contextual action buttons */}
              {activeTab === 'products' && (
                <button
                  onClick={handleOpenAddProduct}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>+</span>
                  <span>Ajouter un Produit</span>
                </button>
              )}
              {activeTab === 'invoices' && (
                <button
                  onClick={handleOpenAddInvoice}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>+</span>
                  <span>Nouvelle Facture</span>
                </button>
              )}
            </div>

            {/* TAB CONTENT AREA */}
            <div className="flex-1 overflow-y-auto p-3">
              {isLoadingDetails ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2" />
                  <span>Chargement des données du fournisseur...</span>
                </div>
              ) : activeTab === 'products' ? (
                /* TAB 1: LIST OF PRODUCTS BOUGHT FROM THIS SUPPLIER */
                supplierProducts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <span className="text-3xl mb-2">📦</span>
                    <p className="font-bold text-gray-700 text-xs">
                      Aucun produit enregistré pour ce fournisseur
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1 max-w-sm">
                      Insérez la liste des articles et marchandises que vous achetez habituellement auprès de{' '}
                      <strong>{selectedSupplier.nom}</strong> avec leurs prix d’achat.
                    </p>
                    <button
                      onClick={handleOpenAddProduct}
                      className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      + Insérer un produit acheté
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[10px] sticky top-0 border-b border-gray-200">
                      <tr>
                        <th className="py-2 px-3">Désignation du Produit</th>
                        <th className="py-2 px-3">Réf / Code</th>
                        <th className="py-2 px-3">Rayon / Catégorie</th>
                        <th className="py-2 px-3 text-right">Prix d'Achat</th>
                        <th className="py-2 px-3">Notes</th>
                        <th className="py-2 px-3 text-center w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {supplierProducts.map((prod) => (
                        <tr key={prod.id} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="py-2 px-3 font-bold text-gray-900">
                            {prod.nom}
                          </td>
                          <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                            {prod.reference || '—'}
                          </td>
                          <td className="py-2 px-3">
                            {prod.categorie ? (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-semibold">
                                {prod.categorie}
                              </span>
                            ) : (
                              <span className="text-gray-300 italic">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-indigo-700 text-xs">
                            {Number(prod.prix_achat).toLocaleString('fr-FR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            DA
                          </td>
                          <td className="py-2 px-3 text-gray-500 text-[11px] truncate max-w-xs" title={prod.notes || ''}>
                            {prod.notes || <span className="text-gray-300 italic">—</span>}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditProduct(prod)}
                                className="p-1 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded transition-all cursor-pointer"
                                title="Modifier ce produit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod)}
                                className="p-1 hover:bg-rose-50 text-gray-500 hover:text-rose-600 rounded transition-all cursor-pointer"
                                title="Supprimer ce produit"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : activeTab === 'invoices' ? (
                /* TAB 2: INVOICES / SUPPLY ORDERS */
                supplierInvoices.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <span className="text-3xl mb-2">🧾</span>
                    <p className="font-bold text-gray-700 text-xs">Aucune facture d'achat enregistrée</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Enregistrez les factures et bons de réapprovisionnement reçus de ce fournisseur.
                    </p>
                    <button
                      onClick={handleOpenAddInvoice}
                      className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      + Enregistrer une facture d'achat
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[10px] sticky top-0 border-b border-gray-200">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Réf Facture</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Montant Total</th>
                        <th className="py-2 px-3 text-right">Montant Payé</th>
                        <th className="py-2 px-3 text-right">Dette Générée</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {supplierInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                            {inv.created_at ? inv.created_at.slice(0, 10) : '—'}
                          </td>
                          <td className="py-2 px-3 font-bold text-indigo-700 font-mono">
                            {inv.reference_facture || `BL-${inv.id}`}
                          </td>
                          <td className="py-2 px-3 text-gray-700">
                            {inv.description || 'Approvisionnement'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                            {Number(inv.montant_total).toLocaleString('fr-FR')} DA
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-600 font-semibold">
                            {Number(inv.montant_paye).toLocaleString('fr-FR')} DA
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                            {Number(inv.dette_generee) > 0
                              ? `${Number(inv.dette_generee).toLocaleString('fr-FR')} DA`
                              : '0.00 DA'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                /* TAB 3: FINANCIAL LEDGER & PAYMENTS */
                supplierLedger.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <span className="text-3xl mb-2">📒</span>
                    <p className="font-bold text-gray-700 text-xs">Aucun mouvement financier enregistré</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[10px] sticky top-0 border-b border-gray-200">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Opération</th>
                        <th className="py-2 px-3">Détail</th>
                        <th className="py-2 px-3 text-right">Montant</th>
                        <th className="py-2 px-3 text-right">Solde Après</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {supplierLedger.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                            {row.date_operation ? row.date_operation.slice(0, 16).replace('T', ' ') : '—'}
                          </td>
                          <td className="py-2 px-3">
                            {row.type_operation === 'FACTURE_ACHAT' ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                🧾 FACTURE ACHAT
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                💰 VERSEMENT
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-gray-700 text-[11px]">
                            {row.description || (row.reference_facture ? `Facture ${row.reference_facture}` : '—')}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-xs">
                            {row.type_operation === 'FACTURE_ACHAT' ? (
                              <span className="text-rose-600">+ {Number(row.montant).toLocaleString('fr-FR')} DA</span>
                            ) : (
                              <span className="text-emerald-600">- {Number(row.montant).toLocaleString('fr-FR')} DA</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-gray-900 text-xs">
                            {Number(row.solde_apres).toLocaleString('fr-FR')} DA
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="col-span-7 bg-white rounded-xl border border-gray-200 shadow-xs flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <span className="text-4xl mb-2">👈</span>
            <p className="font-bold text-gray-700 text-sm">Sélectionnez un fournisseur dans la liste</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Consultez ses coordonnées complètes (téléphone, adresse), la liste de tous les produits achetés auprès de lui, et suivez vos créances d'achat.
            </p>
          </div>
        )}
      </div>

      {/* MODAL 1: AJOUTER / MODIFIER UN FOURNISSEUR */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gray-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🏢</span>
                <h3 className="font-bold text-sm tracking-wide">
                  {editingSupplier ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
                </h3>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-gray-400 hover:text-white text-base leading-none p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSupplier} className="p-5 flex flex-col gap-3.5">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Nom du contact / fournisseur */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nom du fournisseur / Responsable <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={supplierNameRef}
                  type="text"
                  required
                  value={supplierForm.nom}
                  onChange={(e) => setSupplierForm({ ...supplierForm, nom: e.target.value })}
                  placeholder="ex: Mourad Khelifi, Brahimi Agro..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-semibold"
                />
              </div>

              {/* Nom société */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nom de l'entreprise / Société
                </label>
                <input
                  type="text"
                  value={supplierForm.nom_societe}
                  onChange={(e) => setSupplierForm({ ...supplierForm, nom_societe: e.target.value })}
                  placeholder="ex: SARL Cevital, Groupe SIM, Candia..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-semibold"
                />
              </div>

              {/* Téléphone & Dette initiale */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Téléphone (Contact)
                  </label>
                  <input
                    type="tel"
                    value={supplierForm.telephone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, telephone: e.target.value })}
                    placeholder="0550 00 00 00"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Dette initiale (DA)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    disabled={Boolean(editingSupplier)}
                    value={supplierForm.total_dette}
                    onChange={(e) => setSupplierForm({ ...supplierForm, total_dette: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-mono font-bold disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* Adresse */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Adresse / Dépôt / Ville
                </label>
                <input
                  type="text"
                  value={supplierForm.adresse}
                  onChange={(e) => setSupplierForm({ ...supplierForm, adresse: e.target.value })}
                  placeholder="ex: Zone Industrielle Rouiba, Alger"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>💾</span>
                  )}
                  <span>{editingSupplier ? 'Enregistrer' : 'Créer le fournisseur'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AJOUTER / MODIFIER UN PRODUIT ACHETÉ CHEZ CE FOURNISSEUR */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gray-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📦</span>
                <h3 className="font-bold text-sm tracking-wide">
                  {editingProduct ? 'Modifier l’Article Fournisseur' : 'Insérer un Produit Acheté'}
                </h3>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-gray-400 hover:text-white text-base leading-none p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="p-5 flex flex-col gap-3.5">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Fournisseur name reminder */}
              <div className="text-[11px] bg-indigo-50 border border-indigo-200 text-indigo-800 p-2 rounded-lg font-medium flex items-center gap-1">
                <span>🏢 Fournisseur :</span>
                <strong>{selectedSupplier?.nom}</strong>
                {selectedSupplier?.nom_societe && <span>({selectedSupplier.nom_societe})</span>}
              </div>

              {/* Nom du produit */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Désignation / Nom du produit <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={productNameRef}
                  type="text"
                  required
                  value={productForm.nom}
                  onChange={(e) => setProductForm({ ...productForm, nom: e.target.value })}
                  placeholder="ex: Huile Elio 5L, Sucre 50kg, Cartons d'emballage..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-semibold"
                />
              </div>

              {/* Réf & Prix d'achat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Référence / Code article
                  </label>
                  <input
                    type="text"
                    value={productForm.reference}
                    onChange={(e) => setProductForm({ ...productForm, reference: e.target.value })}
                    placeholder="ex: REF-001"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Prix d'Achat Habituel (DA) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={productForm.prix_achat}
                    onChange={(e) => setProductForm({ ...productForm, prix_achat: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-mono font-bold text-indigo-700"
                  />
                </div>
              </div>

              {/* Catégorie & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Rayon / Catégorie
                  </label>
                  <input
                    type="text"
                    value={productForm.categorie}
                    onChange={(e) => setProductForm({ ...productForm, categorie: e.target.value })}
                    placeholder="ex: Agroalimentaire, Emballage..."
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Notes / Conditionnement
                  </label>
                  <input
                    type="text"
                    value={productForm.notes}
                    onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
                    placeholder="ex: Carton de 12, Palette..."
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>💾</span>
                  )}
                  <span>{editingProduct ? 'Mettre à jour' : 'Ajouter le produit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NOUVELLE FACTURE D'ACHAT / RÉAPPROVISIONNEMENT */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gray-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🧾</span>
                <h3 className="font-bold text-sm tracking-wide">
                  Enregistrer une Facture d'Achat
                </h3>
              </div>
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-gray-400 hover:text-white text-base leading-none p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitInvoice} className="p-5 flex flex-col gap-3.5">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              <div className="text-[11px] bg-indigo-50 border border-indigo-200 text-indigo-800 p-2 rounded-lg font-medium flex items-center gap-1">
                <span>🏢 Fournisseur :</span>
                <strong>{selectedSupplier?.nom}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  N° Facture / Référence Bon de Livraison
                </label>
                <input
                  type="text"
                  value={invoiceForm.reference_facture}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, reference_facture: e.target.value })}
                  placeholder="ex: FACT-2026-104"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description / Motif
                </label>
                <input
                  type="text"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  placeholder="Approvisionnement marchandises..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Montant Total (DA) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={invoiceForm.montant_total}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, montant_total: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Montant Payé (Espèces)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={invoiceForm.montant_paye}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, montant_paye: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-gray-900 font-mono font-bold text-emerald-600"
                  />
                </div>
              </div>

              {/* Debt calculation preview */}
              {parseFloat(invoiceForm.montant_total) > 0 && (
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-gray-500">Reste à payer (Dette générée) :</span>
                  <strong className="font-mono text-rose-600 font-bold">
                    {Math.max(
                      0,
                      (parseFloat(invoiceForm.montant_total) || 0) - (parseFloat(invoiceForm.montant_paye) || 0)
                    ).toLocaleString('fr-FR')}{' '}
                    DA
                  </strong>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>💾</span>
                  )}
                  <span>Valider la facture</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RÈGLEMENT DE DETTE FOURNISSEUR */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gray-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💰</span>
                <h3 className="font-bold text-sm tracking-wide">
                  Régler une Dette Fournisseur
                </h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-white text-base leading-none p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-5 flex flex-col gap-3.5">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs">
                <span className="text-rose-800 font-semibold">Dette actuelle envers {selectedSupplier?.nom} :</span>
                <strong className="font-mono text-rose-700 text-sm font-black">
                  {Number(selectedSupplier?.total_dette || 0).toLocaleString('fr-FR')} DA
                </strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Montant du Versement (DA) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={Number(selectedSupplier?.total_dette || 0)}
                  required
                  value={paymentForm.montant}
                  onChange={(e) => setPaymentForm({ ...paymentForm, montant: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-base font-mono font-black text-emerald-600 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Remarque / Motif
                </label>
                <input
                  type="text"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  placeholder="ex: Versement espèces, Virement bancaire..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-gray-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>💸</span>
                  )}
                  <span>Enregistrer le versement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
