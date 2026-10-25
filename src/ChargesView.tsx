import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore, type Charge } from './store';

// Standard predefined categories matching user business use cases
const PREDEFINED_CATEGORIES = [
  { id: 'Loyer', label: 'Loyer', icon: '🏠', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'Carburant', label: 'Carburant', icon: '⛽', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'Emballage', label: 'Emballage', icon: '📦', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'Électricité / Eau', label: 'Électricité / Eau', icon: '💡', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'Salaires', label: 'Salaires', icon: '👥', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'Transport', label: 'Transport', icon: '🚚', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'Entretien', label: 'Entretien', icon: '🔧', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'Autre', label: 'Autre', icon: '📋', color: 'bg-gray-100 text-gray-800 border-gray-200' },
];

export const ChargesView: React.FC = () => {
  const { charges, fetchCharges, addCharge, editCharge, removeCharge } = useAppStore();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null);

  // Form State
  const [formTitre, setFormTitre] = useState('');
  const [formMontant, setFormMontant] = useState('');
  const [formCategorie, setFormCategorie] = useState('Autre');
  const [formCustomCategorie, setFormCustomCategorie] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'TODAY' | 'MONTH' | 'YEAR'>('ALL');

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCharges();
  }, [fetchCharges]);

  // Focus title input when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isModalOpen]);

  // Keyboard shortcut for adding charge: Insert key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Insert' && !isModalOpen) {
        e.preventDefault();
        handleOpenAdd();
      } else if (e.key === 'Escape' && isModalOpen) {
        e.preventDefault();
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Filtered charges
  const filteredCharges = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayStr = now.toISOString().slice(0, 10);

    return charges.filter((c) => {
      // Category filter
      if (selectedCategoryFilter !== 'ALL' && c.categorie !== selectedCategoryFilter) {
        return false;
      }

      // Date range filter
      if (dateRangeFilter !== 'ALL') {
        const itemDate = new Date(c.date_charge);
        if (dateRangeFilter === 'TODAY') {
          if (c.date_charge.slice(0, 10) !== todayStr && itemDate.toISOString().slice(0, 10) !== todayStr) {
            return false;
          }
        } else if (dateRangeFilter === 'MONTH') {
          if (itemDate.getFullYear() !== currentYear || itemDate.getMonth() !== currentMonth) {
            return false;
          }
        } else if (dateRangeFilter === 'YEAR') {
          if (itemDate.getFullYear() !== currentYear) {
            return false;
          }
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = c.titre.toLowerCase().includes(q);
        const matchCat = (c.categorie || '').toLowerCase().includes(q);
        const matchNotes = (c.notes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchNotes) {
          return false;
        }
      }

      return true;
    });
  }, [charges, selectedCategoryFilter, dateRangeFilter, searchQuery]);

  // Dashboard Aggregates & Statistics (Calculated in real-time)
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayStr = now.toISOString().slice(0, 10);

    let totalCumule = 0;
    let totalCeMois = 0;
    let totalAujourdhui = 0;
    let totalCetteAnnee = 0;
    const categoryTotals: Record<string, { total: number; count: number }> = {};

    charges.forEach((c) => {
      const montant = Number(c.montant) || 0;
      totalCumule += montant;

      const itemDate = new Date(c.date_charge);
      const isYear = itemDate.getFullYear() === currentYear;
      const isMonth = isYear && itemDate.getMonth() === currentMonth;
      const isToday = c.date_charge.slice(0, 10) === todayStr || itemDate.toISOString().slice(0, 10) === todayStr;

      if (isYear) totalCetteAnnee += montant;
      if (isMonth) totalCeMois += montant;
      if (isToday) totalAujourdhui += montant;

      const catKey = c.categorie || 'Autre';
      if (!categoryTotals[catKey]) {
        categoryTotals[catKey] = { total: 0, count: 0 };
      }
      categoryTotals[catKey].total += montant;
      categoryTotals[catKey].count += 1;
    });

    const categoryList = Object.entries(categoryTotals)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        percent: totalCumule > 0 ? (data.total / totalCumule) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      totalCumule,
      totalCeMois,
      totalAujourdhui,
      totalCetteAnnee,
      totalOperations: charges.length,
      categoryList,
    };
  }, [charges]);

  // Modal open handlers
  const handleOpenAdd = () => {
    setEditingCharge(null);
    setFormTitre('');
    setFormMontant('');
    setFormCategorie('Loyer');
    setFormCustomCategorie('');
    // Defaults to local current date in YYYY-MM-DD format
    const today = new Date().toISOString().slice(0, 10);
    setFormDate(today);
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (charge: Charge) => {
    setEditingCharge(charge);
    setFormTitre(charge.titre);
    setFormMontant(charge.montant.toString());
    const matchedPreset = PREDEFINED_CATEGORIES.some((c) => c.id === charge.categorie);
    if (matchedPreset) {
      setFormCategorie(charge.categorie);
      setFormCustomCategorie('');
    } else {
      setFormCategorie('Custom');
      setFormCustomCategorie(charge.categorie);
    }
    const chargeDate = charge.date_charge ? charge.date_charge.slice(0, 10) : new Date().toISOString().slice(0, 10);
    setFormDate(chargeDate);
    setFormNotes(charge.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCharge(null);
    setFormError('');
  };

  // Submit charge
  const handleSubmitCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitre.trim()) {
      setFormError("Veuillez renseigner le nom ou l'intitulé de la charge.");
      return;
    }

    const parsedMontant = parseFloat(formMontant);
    if (isNaN(parsedMontant) || parsedMontant <= 0) {
      setFormError('Veuillez saisir un montant valide et supérieur à 0.');
      return;
    }

    let finalCategorie = formCategorie;
    if (formCategorie === 'Custom') {
      finalCategorie = formCustomCategorie.trim() || 'Autre';
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingCharge) {
        await editCharge({
          id: editingCharge.id,
          titre: formTitre.trim(),
          montant: parsedMontant,
          categorie: finalCategorie,
          date_charge: formDate ? `${formDate} 12:00:00` : editingCharge.date_charge,
          notes: formNotes.trim() || undefined,
        });
        showToast(`✅ Charge "${formTitre.trim()}" mise à jour avec succès.`);
      } else {
        await addCharge({
          titre: formTitre.trim(),
          montant: parsedMontant,
          categorie: finalCategorie,
          date_charge: formDate ? `${formDate} 12:00:00` : new Date().toISOString(),
          notes: formNotes.trim() || undefined,
        });
        showToast(`✅ Charge "${formTitre.trim()}" de ${parsedMontant.toLocaleString('fr-FR')} DA ajoutée au tableau de bord.`);
      }

      handleCloseModal();
    } catch (err: any) {
      console.error('Erreur sauvegarde charge:', err);
      setFormError(err.message || 'Erreur lors de l’enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete charge
  const handleDeleteCharge = async (charge: Charge) => {
    const confirmMessage = `Confirmez-vous la suppression de la charge :\n\n"${charge.titre}" - ${charge.montant.toLocaleString('fr-FR')} DA ?\n\nCette action mettra directement à jour le total cumulé.`;
    if (window.confirm(confirmMessage)) {
      try {
        await removeCharge(charge.id);
        showToast(`🗑️ Charge supprimée du tableau de bord.`);
      } catch (err: any) {
        console.error('Erreur suppression charge:', err);
        alert('Impossible de supprimer la charge: ' + err.message);
      }
    }
  };

  // Quick Amount helper buttons
  const addQuickAmount = (amountToAdd: number) => {
    const current = parseFloat(formMontant) || 0;
    setFormMontant((current + amountToAdd).toString());
  };

  const getCategoryBadge = (catName: string) => {
    const preset = PREDEFINED_CATEGORIES.find((c) => c.id === catName);
    if (preset) {
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${preset.color}`}>
          <span>{preset.icon}</span>
          <span>{preset.label}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border bg-gray-100 text-gray-800 border-gray-200">
        <span>📋</span>
        <span>{catName || 'Autre'}</span>
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden bg-gray-100 w-full h-full select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-5 z-50 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl border border-gray-700 flex items-center gap-2 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Action Bar */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span>💸</span>
            <span>Les Charges & Dépenses du Magasin</span>
            <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">
              Frais d'exploitation
            </span>
          </h1>
          <p className="text-xs text-gray-500">
            Saisie manuelle des coûts de votre activité (loyer, carburant, emballage, factures, salaires) avec cumul automatique en temps réel.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
            title="Ajouter une nouvelle dépense (Raccourci: Touche Ins)"
          >
            <span className="text-base font-black">+</span>
            <span>Ajouter une Charge</span>
            <kbd className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded font-mono text-rose-100">Ins</kbd>
          </button>
        </div>
      </div>

      {/* CUMULATIVE DASHBOARD STAT CARDS */}
      <div className="grid grid-cols-4 gap-3 mb-3 shrink-0">
        {/* Card 1: TOTAL CUMULÉ DES CHARGES (Prominent) */}
        <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-xl p-3.5 shadow-md border border-rose-800 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-rose-200 font-bold flex items-center gap-1.5">
              <span>📈</span>
              <span>Total Cumulé des Charges</span>
            </span>
            <span className="text-[10px] bg-rose-800/80 text-rose-200 px-2 py-0.5 rounded-md font-mono font-semibold">
              Global
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-2xl font-black tracking-tight text-white flex items-baseline gap-1.5">
              <span>{dashboardStats.totalCumule.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-sm font-bold text-rose-300">DA</span>
            </div>
          </div>
          <div className="text-[11px] text-rose-300 flex items-center justify-between">
            <span>Cumul total de toutes les dépenses</span>
            <span className="font-mono font-bold bg-white/10 px-1.5 py-0.5 rounded text-white">
              {dashboardStats.totalOperations} dépense(s)
            </span>
          </div>
        </div>

        {/* Card 2: CE MOIS-CI */}
        <div className="bg-white rounded-xl p-3.5 shadow-xs border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1.5">
              <span>📅</span>
              <span>Total Ce Mois-ci</span>
            </span>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-mono font-bold">
              {new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-xl font-black tracking-tight text-gray-900 flex items-baseline gap-1.5">
              <span>{dashboardStats.totalCeMois.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs font-bold text-gray-500">DA</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-400">
            Frais engagés pour le mois en cours
          </div>
        </div>

        {/* Card 3: AUJOURD'HUI */}
        <div className="bg-white rounded-xl p-3.5 shadow-xs border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1.5">
              <span>⚡</span>
              <span>Total Aujourd'hui</span>
            </span>
            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-mono font-bold">
              Aujourd'hui
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-xl font-black tracking-tight text-gray-900 flex items-baseline gap-1.5">
              <span>{dashboardStats.totalAujourdhui.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs font-bold text-gray-500">DA</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-400">
            Dépenses enregistrées ce jour
          </div>
        </div>

        {/* Card 4: CETTE ANNÉE */}
        <div className="bg-white rounded-xl p-3.5 shadow-xs border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1.5">
              <span>🗓️</span>
              <span>Total Année {new Date().getFullYear()}</span>
            </span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-mono font-bold">
              Annuel
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-xl font-black tracking-tight text-gray-900 flex items-baseline gap-1.5">
              <span>{dashboardStats.totalCetteAnnee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs font-bold text-gray-500">DA</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-400">
            Cumul exercice comptable annuel
          </div>
        </div>
      </div>

      {/* CATEGORY BREAKDOWN PILLS */}
      {dashboardStats.categoryList.length > 0 && (
        <div className="bg-white rounded-xl p-2.5 shadow-xs border border-gray-200 mb-3 shrink-0 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <span>🏷️</span>
            <span>Par Poste :</span>
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {dashboardStats.categoryList.map((cat) => {
              const preset = PREDEFINED_CATEGORIES.find((p) => p.id === cat.name);
              const isSelected = selectedCategoryFilter === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategoryFilter(isSelected ? 'ALL' : cat.name)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                  title={`Filtrer par ${cat.name}`}
                >
                  <span>{preset?.icon || '📋'}</span>
                  <span>{cat.name}</span>
                  <span className="font-mono font-bold ml-1 text-[11px] text-rose-600">
                    {cat.total.toLocaleString('fr-FR')} DA
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    ({cat.percent.toFixed(0)}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white p-2.5 rounded-t-xl border-x border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom (loyer, carburant, emballage...) ou remarque..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white text-gray-900 font-medium"
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

          {/* Category Filter dropdown */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-rose-500 cursor-pointer"
          >
            <option value="ALL">Toutes les catégories</option>
            {PREDEFINED_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>

          {/* Date Filter Pills */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              onClick={() => setDateRangeFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                dateRangeFilter === 'ALL' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Tout
            </button>
            <button
              onClick={() => setDateRangeFilter('TODAY')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                dateRangeFilter === 'TODAY' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setDateRangeFilter('MONTH')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                dateRangeFilter === 'MONTH' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Ce Mois
            </button>
            <button
              onClick={() => setDateRangeFilter('YEAR')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                dateRangeFilter === 'YEAR' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Cette Année
            </button>
          </div>
        </div>

        {/* Filtered count and subtotal */}
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 shrink-0">
          <span>
            Affichage: <strong className="text-gray-900">{filteredCharges.length}</strong> ligne(s)
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Sous-total filtré:{' '}
            <strong className="text-rose-600 font-mono font-bold">
              {filteredCharges.reduce((acc, c) => acc + (Number(c.montant) || 0), 0).toLocaleString('fr-FR')} DA
            </strong>
          </span>
        </div>
      </div>

      {/* TABLE LIST OF CHARGES */}
      <div className="flex-1 bg-white border border-gray-200 rounded-b-xl overflow-hidden flex flex-col shadow-xs">
        <div className="flex-1 overflow-y-auto">
          {filteredCharges.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
              <span className="text-4xl mb-2">💸</span>
              <p className="font-bold text-gray-700 text-sm">Aucune charge trouvée</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                {charges.length === 0
                  ? "Vous n'avez pas encore enregistré de charge d'exploitation. Cliquez sur 'Ajouter une Charge' pour saisir vos frais de loyer, carburant, emballage, etc."
                  : 'Aucun enregistrement ne correspond à vos critères de recherche ou filtres de date.'}
              </p>
              <button
                onClick={handleOpenAdd}
                className="mt-4 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                + Ajouter une charge maintenant
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[11px] sticky top-0 border-b border-gray-200 z-10 shadow-2xs">
                <tr>
                  <th className="py-2.5 px-4 w-32">Date</th>
                  <th className="py-2.5 px-4 w-40">Catégorie</th>
                  <th className="py-2.5 px-4">Intitulé / Nom de la Charge</th>
                  <th className="py-2.5 px-4 w-52">Notes & Remarques</th>
                  <th className="py-2.5 px-4 text-right w-36">Montant</th>
                  <th className="py-2.5 px-4 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCharges.map((charge) => {
                  return (
                    <tr key={charge.id} className="hover:bg-rose-50/40 transition-colors group">
                      {/* Date */}
                      <td className="py-2.5 px-4 font-mono text-gray-500 whitespace-nowrap">
                        {charge.date_charge ? charge.date_charge.slice(0, 10) : '—'}
                      </td>

                      {/* Category Badge */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {getCategoryBadge(charge.categorie)}
                      </td>

                      {/* Name / Title */}
                      <td className="py-2.5 px-4 font-bold text-gray-900">
                        {charge.titre}
                      </td>

                      {/* Notes / Remarks */}
                      <td className="py-2.5 px-4 text-gray-500 text-[11px] truncate max-w-xs" title={charge.notes || ''}>
                        {charge.notes ? (
                          <span className="flex items-center gap-1">
                            <span>📝</span>
                            <span>{charge.notes}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300 italic">—</span>
                        )}
                      </td>

                      {/* Amount (DA) */}
                      <td className="py-2.5 px-4 text-right font-mono font-black text-rose-600 text-sm whitespace-nowrap">
                        - {Number(charge.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
                      </td>

                      {/* Action buttons */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 opacity-90 group-hover:opacity-100">
                          <button
                            onClick={() => handleOpenEdit(charge)}
                            className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-all cursor-pointer"
                            title="Modifier cette charge"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteCharge(charge)}
                            className="p-1 text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                            title="Supprimer cette charge"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: AJOUTER / MODIFIER UNE CHARGE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gray-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💸</span>
                <h3 className="font-bold text-sm tracking-wide">
                  {editingCharge ? 'Modifier la Charge' : 'Ajouter une Nouvelle Charge'}
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-white text-base leading-none p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitCharge} className="p-5 flex flex-col gap-4">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Input: Nom / Intitulé de la charge */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nom / Intitulé de la charge <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  required
                  value={formTitre}
                  onChange={(e) => setFormTitre(e.target.value)}
                  placeholder="ex: Loyer magasin, Plein carburant Kangoo, 1000 sachets..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-gray-900 font-semibold"
                />
              </div>

              {/* Input: Montant (DA) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700">
                    Montant de la charge (DA) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-gray-400">Dinars Algériens</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={formMontant}
                    onChange={(e) => setFormMontant(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-3 pr-12 py-2 text-base font-mono font-black text-rose-600 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-gray-400 pointer-events-none">
                    DA
                  </span>
                </div>

                {/* Quick Add buttons for common amounts */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Ajout rapide:</span>
                  <button
                    type="button"
                    onClick={() => addQuickAmount(500)}
                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-mono font-bold rounded cursor-pointer"
                  >
                    +500
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuickAmount(1000)}
                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-mono font-bold rounded cursor-pointer"
                  >
                    +1 000
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuickAmount(5000)}
                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-mono font-bold rounded cursor-pointer"
                  >
                    +5 000
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuickAmount(10000)}
                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-mono font-bold rounded cursor-pointer"
                  >
                    +10 000
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuickAmount(50000)}
                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-mono font-bold rounded cursor-pointer"
                  >
                    +50 000
                  </button>
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Catégorie de la dépense
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {PREDEFINED_CATEGORIES.map((cat) => {
                    const isSelected = formCategorie === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setFormCategorie(cat.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-50 border-rose-500 text-rose-900 font-bold ring-1 ring-rose-500'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-base">{cat.icon}</span>
                        <span className="text-[10px] mt-0.5 truncate w-full">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom category input if needed */}
                {formCategorie === 'Autre' && (
                  <input
                    type="text"
                    value={formCustomCategorie}
                    onChange={(e) => setFormCustomCategorie(e.target.value)}
                    placeholder="Préciser une catégorie personnalisée..."
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-gray-900"
                  />
                )}
              </div>

              {/* Date Input */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Date de la dépense
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-gray-900 font-mono"
                  />
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Remarque (optionnel)
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="ex: Payé en espèces, N° facture..."
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-gray-900"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>💾</span>
                  )}
                  <span>{editingCharge ? 'Enregistrer les modifications' : 'Ajouter la charge'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
