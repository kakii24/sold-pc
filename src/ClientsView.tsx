import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from './store';
import type { Client } from './store';
import { ReceiptPreviewModal, type ReceiptData } from './ReceiptPreviewModal';

interface SaleRecord {
  id: number;
  type_vente: 'GROS' | 'DETAIL';
  total_ht: number;
  montant_verse: number;
  dette_generee: number;
  created_at: string;
  item_count?: number;
}

interface SaleItemDetail {
  id: number;
  sale_id: number;
  product_id: number;
  quantite: number;
  prix_achat_unitaire: number;
  prix_vente_unitaire: number;
  total_ligne: number;
  product_nom?: string;
  product_code_barre?: string;
}

interface LedgerRecord {
  id: number;
  client_id: number;
  sale_id: number | null;
  type_operation: 'VENTE_CREDIT' | 'VERSEMENT_DETTE';
  montant: number;
  solde_apres: number;
  date_operation: string;
  sale_total?: number;
}

export const ClientsView: React.FC = () => {
  const { clients, fetchClients, addClient, editClient } = useAppStore();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'debtors' | 'cleared'>('all');

  // Modals & Drawers state
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientForProfile, setSelectedClientForProfile] = useState<Client | null>(null);

  // Profile Drawer Tab
  const [profileTab, setProfileTab] = useState<'sales' | 'ledger'>('sales');
  const [clientSales, setClientSales] = useState<SaleRecord[]>([]);
  const [clientLedger, setClientLedger] = useState<LedgerRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Sale detail inspection modal
  const [inspectingSale, setInspectingSale] = useState<SaleRecord | null>(null);
  const [inspectingSaleItems, setInspectingSaleItems] = useState<SaleItemDetail[]>([]);
  const [isLoadingSaleDetails, setIsLoadingSaleDetails] = useState(false);
  const [reprintReceiptData, setReprintReceiptData] = useState<ReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Inline Debt Payment inside Client Profile
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [repayAmountInput, setRepayAmountInput] = useState('');
  const [isSubmittingRepay, setIsSubmittingRepay] = useState(false);

  // New Client Form
  const [newClientData, setNewClientData] = useState({
    nom: '',
    nom_magasin: '',
    telephone: '',
    adresse: '',
  });

  // Edit Client Form
  const [editClientData, setEditClientData] = useState({
    nom: '',
    nom_magasin: '',
    telephone: '',
    adresse: '',
  });

  // Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load clients on mount
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Insert') {
        e.preventDefault();
        setIsNewClientModalOpen(true);
      } else if (e.key === 'Escape') {
        if (inspectingSale) {
          setInspectingSale(null);
        } else if (isRepaymentModalOpen) {
          setIsRepaymentModalOpen(false);
        } else if (editingClient) {
          setEditingClient(null);
        } else if (isNewClientModalOpen) {
          setIsNewClientModalOpen(false);
        } else if (selectedClientForProfile) {
          setSelectedClientForProfile(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingSale, isRepaymentModalOpen, editingClient, isNewClientModalOpen, selectedClientForProfile]);

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.nom.toLowerCase().includes(q) ||
        c.nom_magasin.toLowerCase().includes(q) ||
        (c.telephone && c.telephone.toLowerCase().includes(q)) ||
        (c.adresse && c.adresse.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'debtors') {
        return c.total_dette > 0;
      }
      if (statusFilter === 'cleared') {
        return c.total_dette <= 0;
      }
      return true;
    });
  }, [clients, searchQuery, statusFilter]);

  // Metrics
  const totalClientsCount = clients.length;
  const totalMarketDebt = clients.reduce((sum, c) => sum + (c.total_dette || 0), 0);
  const debtorsCount = clients.filter((c) => c.total_dette > 0).length;
  const clearedCount = clients.filter((c) => c.total_dette <= 0).length;

  // Load client profile history (sales & ledger)
  const loadClientHistory = async (clientId: number) => {
    setIsLoadingHistory(true);
    try {
      // @ts-ignore
      const [sales, ledger] = await Promise.all([
        // @ts-ignore
        window.api.getClientSales(clientId),
        // @ts-ignore
        window.api.getClientLedger(clientId),
      ]);
      setClientSales(sales || []);
      setClientLedger(ledger || []);
    } catch (err) {
      console.error('Failed to load client history:', err);
      showToast('Erreur lors du chargement de l’historique');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Open Client Profile
  const handleOpenClientProfile = (client: Client) => {
    setSelectedClientForProfile(client);
    setProfileTab('sales');
    loadClientHistory(client.id);
  };

  // Open Sale details
  const handleInspectSale = async (sale: SaleRecord) => {
    setInspectingSale(sale);
    setIsLoadingSaleDetails(true);
    try {
      // @ts-ignore
      const res = await window.api.getSaleDetails(sale.id);
      setInspectingSaleItems(res?.items || []);
    } catch (err) {
      console.error('Failed to load sale details:', err);
    } finally {
      setIsLoadingSaleDetails(false);
    }
  };

  // Submit New Client
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientData.nom.trim() || !newClientData.nom_magasin.trim()) {
      showToast('Veuillez renseigner le nom et le nom du magasin.');
      return;
    }

    try {
      const created = await addClient({
        nom: newClientData.nom.trim(),
        nom_magasin: newClientData.nom_magasin.trim(),
        telephone: newClientData.telephone.trim(),
        adresse: newClientData.adresse.trim(),
      });
      setIsNewClientModalOpen(false);
      setNewClientData({ nom: '', nom_magasin: '', telephone: '', adresse: '' });
      showToast(`Client "${created.nom}" enregistré avec succès.`);
    } catch (err: any) {
      showToast(`Erreur création client: ${err.message || 'Échec'}`);
    }
  };

  // Open Edit Client Modal
  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setEditClientData({
      nom: client.nom,
      nom_magasin: client.nom_magasin,
      telephone: client.telephone || '',
      adresse: client.adresse || '',
    });
  };

  // Submit Edit Client
  const handleSaveEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    if (!editClientData.nom.trim() || !editClientData.nom_magasin.trim()) {
      showToast('Veuillez renseigner le nom et le nom du magasin.');
      return;
    }

    try {
      const updated = await editClient({
        id: editingClient.id,
        nom: editClientData.nom.trim(),
        nom_magasin: editClientData.nom_magasin.trim(),
        telephone: editClientData.telephone.trim(),
        adresse: editClientData.adresse.trim(),
      });
      setEditingClient(null);
      if (selectedClientForProfile && selectedClientForProfile.id === updated.id) {
        setSelectedClientForProfile(updated);
      }
      showToast(`Client "${updated.nom}" mis à jour.`);
    } catch (err: any) {
      showToast(`Erreur mise à jour client: ${err.message || 'Échec'}`);
    }
  };

  // Direct Debt Payment confirmation
  const handleConfirmDebtPayment = async () => {
    if (!selectedClientForProfile) return;
    const amount = Number(repayAmountInput);
    if (isNaN(amount) || amount <= 0) {
      showToast('Veuillez saisir un montant valide.');
      return;
    }

    setIsSubmittingRepay(true);
    try {
      // @ts-ignore
      const result = await window.api.payClientDebt(selectedClientForProfile.id, amount);
      if (result.success) {
        showToast(`Règlement de ${result.montantPaye.toLocaleString()} DA enregistré avec succès.`);
        setIsRepaymentModalOpen(false);
        setRepayAmountInput('');

        // Refresh clients list & current client state
        await fetchClients();
        setSelectedClientForProfile(result.client);

        // Reload history
        await loadClientHistory(selectedClientForProfile.id);
      } else {
        showToast(result.error || 'Erreur lors du versement.');
      }
    } catch (err: any) {
      showToast(`Erreur: ${err.message || 'Échec du versement.'}`);
    } finally {
      setIsSubmittingRepay(false);
    }
  };

  // Format currency
  const formatMoney = (val: number) => {
    return (val || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DA';
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('fr-DZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-fade-in text-sm font-medium">
          <span className="text-emerald-400 text-lg">●</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Metrics Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 shadow-2xs shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 bg-blue-100 text-blue-700 rounded-lg text-base">👥</span>
              <div>
                <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Fiches Clients & Crédits
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Grand Livre & Suivi
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500">
                  Répertoire officiel des clients, créances et historique comptable.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNewClientModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <span>👤+</span>
              <span>Nouveau Client</span>
              <kbd className="text-[10px] bg-blue-800/60 px-1 py-0.2 rounded font-mono font-normal">Ins</kbd>
            </button>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          {/* Card 1: Total Clients */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 px-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Clients</p>
              <p className="text-lg font-black text-slate-900 mt-0.5 font-mono">{totalClientsCount}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-base">
              🏪
            </div>
          </div>

          {/* Card 2: Total Market Debt */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-2 px-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                <span>⚠️</span> Encours / Dette
              </p>
              <p className="text-base font-black text-rose-700 mt-0.5 font-mono">
                {formatMoney(totalMarketDebt)}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-base font-bold">
              💳
            </div>
          </div>

          {/* Card 3: Debtors count */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2 px-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Débiteurs</p>
              <p className="text-lg font-black text-amber-900 mt-0.5 font-mono">
                {debtorsCount}
                <span className="text-[11px] font-normal text-amber-700 ml-1">
                  ({totalClientsCount > 0 ? Math.round((debtorsCount / totalClientsCount) * 100) : 0}%)
                </span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-base font-bold">
              ⏳
            </div>
          </div>

          {/* Card 4: Cleared accounts */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2 px-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Comptes Soldés</p>
              <p className="text-lg font-black text-emerald-900 mt-0.5 font-mono">
                {clearedCount}
                <span className="text-[11px] font-normal text-emerald-700 ml-1">à jour</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-base font-bold">
              ✓
            </div>
          </div>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 text-xs">
            🔍
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher nom, magasin, tél..."
            className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded text-xs transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tous ({totalClientsCount})
          </button>
          <button
            onClick={() => setStatusFilter('debtors')}
            className={`px-2.5 py-1 rounded text-xs transition-all flex items-center gap-1 cursor-pointer ${
              statusFilter === 'debtors'
                ? 'bg-rose-600 text-white shadow-2xs font-bold'
                : 'text-rose-700 hover:bg-rose-100/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Débiteurs ({debtorsCount})
          </button>
          <button
            onClick={() => setStatusFilter('cleared')}
            className={`px-2.5 py-1 rounded text-xs transition-all flex items-center gap-1 cursor-pointer ${
              statusFilter === 'cleared'
                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                : 'text-emerald-700 hover:bg-emerald-100/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Soldés ({clearedCount})
          </button>
        </div>

        {/* Counter & Refresh */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="text-[11px]">
            {filteredClients.length} / {totalClientsCount}
          </span>
          <button
            onClick={() => fetchClients()}
            title="Rafraîchir"
            className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer text-xs"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 overflow-auto p-2.5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                <tr>
                  <th className="py-2 px-3">Client & Établissement</th>
                  <th className="py-2 px-3">Téléphone</th>
                  <th className="py-2 px-3">Adresse</th>
                  <th className="py-2 px-3 text-right">Solde Dette</th>
                  <th className="py-2 px-3 text-center">Inscription</th>
                  <th className="py-2 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <span className="text-3xl mb-2">🔍</span>
                        <p className="font-bold text-slate-700 text-xs">Aucun client trouvé</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {searchQuery
                            ? `Aucun résultat pour "${searchQuery}".`
                            : 'Aucun client enregistré.'}
                        </p>
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="mt-2 text-xs font-bold text-blue-600 hover:underline"
                          >
                            Effacer le filtre
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const hasDebt = client.total_dette > 0;
                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                        onClick={() => handleOpenClientProfile(client)}
                      >
                        {/* Name & Store */}
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                                hasDebt
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {client.nom.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-xs leading-tight">
                                {client.nom}
                              </p>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <span>🏪</span> {client.nom_magasin}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Telephone */}
                        <td className="py-1.5 px-3 font-mono text-[11px]">
                          {client.telephone ? (
                            <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                              <span>📞</span> {client.telephone}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </td>

                        {/* Address */}
                        <td className="py-1.5 px-3 text-[11px] text-slate-600 max-w-xs truncate">
                          {client.adresse ? (
                            <span className="flex items-center gap-1 truncate">
                              <span>📍</span> {client.adresse}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>

                        {/* Debt Balance */}
                        <td className="py-1.5 px-3 text-right">
                          {hasDebt ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="font-mono font-black text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.2 rounded shadow-2xs">
                                {formatMoney(client.total_dette)}
                              </span>
                              <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">
                                Dette
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-end">
                              <span className="font-mono font-bold text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                0.00 DA
                              </span>
                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                                À jour
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Inscription Date */}
                        <td className="py-1.5 px-3 text-center font-mono text-[11px] text-slate-500">
                          {formatDate(client.created_at)}
                        </td>

                        {/* Actions */}
                        <td
                          className="py-1.5 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenClientProfile(client)}
                              title="Fiche client"
                              className="px-2 py-0.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded text-[11px] font-bold transition-all border border-blue-200/80 hover:border-transparent flex items-center gap-1 cursor-pointer"
                            >
                              <span>📋</span> Fiche
                            </button>
                            <button
                              onClick={() => handleOpenEdit(client)}
                              title="Modifier coordonnées"
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition-colors cursor-pointer"
                            >
                              ✏️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CLIENT PROFILE DETAIL DRAWER / FULL MODAL                               */}
      {/* ========================================================================= */}
      {selectedClientForProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in">
          {/* Backdrop Click */}
          <div
            className="flex-1"
            onClick={() => setSelectedClientForProfile(null)}
          />

          {/* Drawer Body */}
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col z-10 animate-slide-left">
            {/* Drawer Header */}
            <div className="bg-slate-900 text-white p-6 shrink-0 relative overflow-hidden">
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(selectedClientForProfile)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors border border-slate-700"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => setSelectedClientForProfile(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Identity & Store */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black shadow-lg">
                  {selectedClientForProfile.nom.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    {selectedClientForProfile.nom}
                  </h2>
                  <p className="text-blue-300 font-semibold text-sm flex items-center gap-1.5 mt-0.5">
                    <span>🏪</span> {selectedClientForProfile.nom_magasin}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                    {selectedClientForProfile.telephone && (
                      <span className="flex items-center gap-1 font-mono">
                        <span>📞</span> {selectedClientForProfile.telephone}
                      </span>
                    )}
                    {selectedClientForProfile.adresse && (
                      <span className="flex items-center gap-1">
                        <span>📍</span> {selectedClientForProfile.adresse}
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-mono">
                      <span>📅</span> Client depuis le {formatDate(selectedClientForProfile.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Big Debt Card & Settlement Action Button */}
              <div className="mt-5 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Solde Débiteur Actuel (Créance en cours)
                  </p>
                  <p
                    className={`text-3xl font-black font-mono mt-1 ${
                      selectedClientForProfile.total_dette > 0
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {formatMoney(selectedClientForProfile.total_dette)}
                  </p>
                </div>

                {/* Direct Repayment Button */}
                {selectedClientForProfile.total_dette > 0 ? (
                  <button
                    onClick={() => {
                      setRepayAmountInput(String(selectedClientForProfile.total_dette));
                      setIsRepaymentModalOpen(true);
                    }}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black text-sm rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>⚡</span>
                    <span>Encaisser Règlement</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded-xl text-xs font-bold">
                    <span>✓</span> Compte soldé & sans dette
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Tabs for Profile */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setProfileTab('sales')}
                  className={`py-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                    profileTab === 'sales'
                      ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🛒</span>
                  <span>Historique des Ventes</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {clientSales.length}
                  </span>
                </button>

                <button
                  onClick={() => setProfileTab('ledger')}
                  className={`py-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                    profileTab === 'ledger'
                      ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>📖</span>
                  <span>Journal des Crédits (Grand Livre)</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {clientLedger.length}
                  </span>
                </button>
              </div>

              <button
                onClick={() => loadClientHistory(selectedClientForProfile.id)}
                title="Actualiser l'historique"
                className="text-xs text-slate-500 hover:text-slate-800 p-1 rounded-md"
              >
                🔄 Actualiser
              </button>
            </div>

            {/* Tab Contents Area */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              {isLoadingHistory ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-xs font-bold">Chargement des opérations...</p>
                </div>
              ) : profileTab === 'sales' ? (
                /* ========================================================= */
                /* TAB 1: HISTORIQUE DES VENTES                              */
                /* ========================================================= */
                <div className="space-y-4">
                  {clientSales.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                      <span className="text-4xl">🛒</span>
                      <p className="font-bold text-slate-700 mt-2">Aucune vente enregistrée</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Ce client n’a encore réalisé aucun achat de gros.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">Date & Heure</th>
                            <th className="py-2.5 px-3">N° Bon</th>
                            <th className="py-2.5 px-3 text-right">Total HT</th>
                            <th className="py-2.5 px-3 text-right">Versé</th>
                            <th className="py-2.5 px-3 text-right">Reste Dette</th>
                            <th className="py-2.5 px-3 text-center">Détail</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {clientSales.map((sale) => (
                            <tr
                              key={sale.id}
                              className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                              onClick={() => handleInspectSale(sale)}
                            >
                              <td className="py-3 px-3 text-slate-600">
                                {formatDate(sale.created_at)}
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-800">
                                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                                  #VTE-{String(sale.id).padStart(4, '0')}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-black text-slate-900">
                                {formatMoney(sale.total_ht)}
                              </td>
                              <td className="py-3 px-3 text-right text-emerald-700 font-bold">
                                {formatMoney(sale.montant_verse)}
                              </td>
                              <td className="py-3 px-3 text-right font-black">
                                {sale.dette_generee > 0 ? (
                                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                    +{formatMoney(sale.dette_generee)}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                    0.00 DA (Comptant)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center font-sans">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInspectSale(sale);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg text-[11px] font-bold text-slate-700 transition-colors cursor-pointer"
                                >
                                  👁️ Articles
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* ========================================================= */
                /* TAB 2: JOURNAL DES CRÉDITS (DEBT LEDGER)                  */
                /* ========================================================= */
                <div className="space-y-4">
                  {clientLedger.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                      <span className="text-4xl">📖</span>
                      <p className="font-bold text-slate-700 mt-2">Aucun mouvement de crédit</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Aucun crédit ou versement n’a été enregistré pour ce client.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Type d'opération</th>
                            <th className="py-2.5 px-3">Référence</th>
                            <th className="py-2.5 px-3 text-right">Variation Montant</th>
                            <th className="py-2.5 px-3 text-right">Solde Résultant</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {clientLedger.map((entry) => {
                            const isCredit = entry.type_operation === 'VENTE_CREDIT';
                            return (
                              <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-3 text-slate-600">
                                  {formatDate(entry.date_operation)}
                                </td>
                                <td className="py-3 px-3 font-sans">
                                  {isCredit ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                      🔴 Vente à crédit
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      🟢 Versement dette
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-slate-700">
                                  {entry.sale_id ? (
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                      Bon #VTE-{String(entry.sale_id).padStart(4, '0')}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-sans italic text-[11px]">
                                      Règlement espèces
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-black">
                                  {isCredit ? (
                                    <span className="text-rose-700">
                                      +{formatMoney(entry.montant)}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700">
                                      -{formatMoney(entry.montant)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-black text-slate-900 bg-slate-50/50">
                                  {formatMoney(entry.solde_apres)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SALE ITEMS BREAKDOWN MODAL                                                */}
      {/* ========================================================================= */}
      {inspectingSale && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-scale-up">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <span>🧾</span> Bon de Vente #VTE-{String(inspectingSale.id).padStart(4, '0')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Émis le {formatDate(inspectingSale.created_at)}
                </p>
              </div>
              <button
                onClick={() => setInspectingSale(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {isLoadingSaleDetails ? (
                <div className="h-40 flex items-center justify-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Article</th>
                          <th className="py-2 px-3 text-center">Qté</th>
                          <th className="py-2 px-3 text-right">P.U (Gros)</th>
                          <th className="py-2 px-3 text-right">Total Ligne</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectingSaleItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-slate-800">
                                {item.product_nom || `Produit #${item.product_id}`}
                              </p>
                              {item.product_code_barre && (
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {item.product_code_barre}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              {item.quantite}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {formatMoney(item.prix_vente_unitaire)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                              {formatMoney(item.total_ligne)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Footer */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-3 gap-3 text-center font-mono">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-sans font-bold">Total Vente</p>
                      <p className="text-base font-black text-slate-900 mt-0.5">
                        {formatMoney(inspectingSale.total_ht)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-sans font-bold">Montant Versé</p>
                      <p className="text-base font-black text-emerald-700 mt-0.5">
                        {formatMoney(inspectingSale.montant_verse)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-sans font-bold">Dette Restante</p>
                      <p className="text-base font-black text-rose-700 mt-0.5">
                        {formatMoney(inspectingSale.dette_generee)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const receipt: ReceiptData = {
                    saleId: inspectingSale.id,
                    type_vente: inspectingSale.type_vente,
                    date: inspectingSale.created_at,
                    items: inspectingSaleItems.map((i) => ({
                      nom: i.product_nom || `Produit #${i.product_id}`,
                      code_barre: i.product_code_barre,
                      quantite: i.quantite,
                      prix_vente: i.prix_vente_unitaire,
                      total_ligne: i.total_ligne,
                    })),
                    total_ht: inspectingSale.total_ht,
                    montant_verse: inspectingSale.montant_verse,
                    monnaie_rendue: Math.max(0, inspectingSale.montant_verse - inspectingSale.total_ht),
                    client: selectedClientForProfile ? {
                      nom: selectedClientForProfile.nom,
                      nom_magasin: selectedClientForProfile.nom_magasin,
                      telephone: selectedClientForProfile.telephone,
                      adresse: selectedClientForProfile.adresse,
                    } : undefined,
                    dette_vente: inspectingSale.dette_generee,
                    nouveau_solde: selectedClientForProfile?.total_dette,
                  };
                  setReprintReceiptData(receipt);
                  setIsReceiptModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>🖨️</span>
                <span>Imprimer Ticket</span>
              </button>

              <button
                onClick={() => setInspectingSale(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIRECT DEBT REPAYMENT MODAL                                               */}
      {/* ========================================================================= */}
      {isRepaymentModalOpen && selectedClientForProfile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <span>⚡</span> Encaisser Règlement Dette
                </h3>
                <p className="text-xs text-rose-300 mt-0.5">
                  Client: {selectedClientForProfile.nom} ({selectedClientForProfile.nom_magasin})
                </p>
              </div>
              <button
                onClick={() => setIsRepaymentModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-rose-950/60 hover:bg-rose-800 text-rose-200 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Debt overview */}
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-rose-700 uppercase">Dette Actuelle</p>
                  <p className="text-2xl font-black font-mono text-rose-800 mt-0.5">
                    {formatMoney(selectedClientForProfile.total_dette)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRepayAmountInput(String(selectedClientForProfile.total_dette))}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Payer la Totalité
                </button>
              </div>

              {/* Payment input */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Montant Reçu / Versé (DA) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    autoFocus
                    value={repayAmountInput}
                    onChange={(e) => setRepayAmountInput(e.target.value)}
                    placeholder="Ex: 5000"
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border-2 border-slate-300 focus:border-rose-600 focus:bg-white rounded-xl text-xl font-mono font-black text-slate-900 focus:outline-none transition-all"
                  />
                  <span className="absolute inset-y-0 right-0 pr-4 flex items-center font-bold text-slate-400 text-sm">
                    DA
                  </span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2">
                {[1000, 2000, 5000, 10000, 20000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRepayAmountInput(String(preset))}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    +{preset.toLocaleString()} DA
                  </button>
                ))}
              </div>

              {/* Real-time Calculation Breakdown */}
              {Number(repayAmountInput) > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Montant appliqué :</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatMoney(
                        Math.min(selectedClientForProfile.total_dette, Number(repayAmountInput) || 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Dette restante après opération :</span>
                    <span className="font-mono font-black text-rose-700">
                      {formatMoney(
                        Math.max(0, selectedClientForProfile.total_dette - (Number(repayAmountInput) || 0))
                      )}
                    </span>
                  </div>
                  {Number(repayAmountInput) > selectedClientForProfile.total_dette && (
                    <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-200 pt-2">
                      <span>Monnaie à rendre :</span>
                      <span className="font-mono text-sm">
                        {formatMoney(Number(repayAmountInput) - selectedClientForProfile.total_dette)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsRepaymentModalOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSubmittingRepay || Number(repayAmountInput) <= 0}
                onClick={handleConfirmDebtPayment}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmittingRepay ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Validation...</span>
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    <span>Confirmer l'Encaissement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NEW CLIENT MODAL                                                          */}
      {/* ========================================================================= */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <span>👤+</span> Nouveau Client de Gros
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  Enregistrement d'un nouveau compte client
                </p>
              </div>
              <button
                onClick={() => setIsNewClientModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Nom & Prénom *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newClientData.nom}
                  onChange={(e) => setNewClientData({ ...newClientData, nom: e.target.value })}
                  placeholder="Ex: Ahmed Benali"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl text-sm font-semibold text-slate-900 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Nom du Magasin / Enseigne *
                </label>
                <input
                  type="text"
                  required
                  value={newClientData.nom_magasin}
                  onChange={(e) => setNewClientData({ ...newClientData, nom_magasin: e.target.value })}
                  placeholder="Ex: Alimentation El Baraka"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl text-sm font-semibold text-slate-900 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Numéro de Téléphone
                </label>
                <input
                  type="tel"
                  value={newClientData.telephone}
                  onChange={(e) => setNewClientData({ ...newClientData, telephone: e.target.value })}
                  placeholder="Ex: 0550 12 34 56"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl text-sm font-semibold text-slate-900 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Adresse / Ville
                </label>
                <input
                  type="text"
                  value={newClientData.adresse}
                  onChange={(e) => setNewClientData({ ...newClientData, adresse: e.target.value })}
                  placeholder="Ex: Kouba, Alger"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl text-sm font-semibold text-slate-900 focus:outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs rounded-xl shadow-md shadow-blue-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✓</span>
                  <span>Enregistrer Client</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT CLIENT MODAL                                                         */}
      {/* ========================================================================= */}
      {editingClient && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <span>✏️</span> Modifier Fiche Client
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ID #{editingClient.id} — {editingClient.nom}
                </p>
              </div>
              <button
                onClick={() => setEditingClient(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditClient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Nom & Prénom *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editClientData.nom}
                  onChange={(e) => setEditClientData({ ...editClientData, nom: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl text-sm font-semibold text-slate-900 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Nom du Magasin / Enseigne *
                </label>
                <input
                  type="text"
                  required
                  value={editClientData.nom_magasin}
                  onChange={(e) => setEditClientData({ ...editClientData, nom_magasin: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl text-sm font-semibold text-slate-900 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Numéro de Téléphone
                </label>
                <input
                  type="tel"
                  value={editClientData.telephone}
                  onChange={(e) => setEditClientData({ ...editClientData, telephone: e.target.value })}
                  placeholder="Ex: 0550 12 34 56"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl text-sm font-semibold text-slate-900 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Adresse / Ville
                </label>
                <input
                  type="text"
                  value={editClientData.adresse}
                  onChange={(e) => setEditClientData({ ...editClientData, adresse: e.target.value })}
                  placeholder="Ex: Kouba, Alger"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl text-sm font-semibold text-slate-900 focus:outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>💾</span>
                  <span>Mettre à jour</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Receipt Preview Modal */}
      <ReceiptPreviewModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receiptData={reprintReceiptData}
      />
    </div>
  );
};
