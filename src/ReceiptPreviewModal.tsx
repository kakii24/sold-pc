import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ReceiptItem {
  nom: string;
  code_barre?: string;
  quantite: number;
  prix_vente: number;
  total_ligne: number;
}

export interface ReceiptData {
  saleId?: number;
  type_vente?: 'GROS' | 'DETAIL';
  date?: string;
  items?: ReceiptItem[];
  total_ht?: number;
  montant_verse?: number;
  monnaie_rendue?: number;
  client?: {
    nom?: string;
    nom_magasin?: string;
    telephone?: string;
    adresse?: string;
  };
  ancien_credit?: number;
  dette_vente?: number;
  nouveau_solde?: number;
}

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData?: ReceiptData | null;
  onPrinted?: () => void;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  receiptData,
  onPrinted,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);

  // Keyboard navigation: Enter -> Print, Esc -> Close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, receiptData]);

  if (!isOpen) return null;

  // Safe formatting helpers
  const formatMoney = (val?: number) => {
    const num = Number(val) || 0;
    return num.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DA';
  };

  const safeDate = () => {
    try {
      const d = receiptData?.date ? new Date(receiptData.date) : new Date();
      if (isNaN(d.getTime())) return new Date().toLocaleString('fr-DZ');
      return d.toLocaleDateString('fr-DZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return new Date().toLocaleString('fr-DZ');
    }
  };

  // Safe extractions
  const saleId = receiptData?.saleId ? String(receiptData.saleId).padStart(4, '0') : '0001';
  const items = Array.isArray(receiptData?.items) ? receiptData!.items : [];
  
  // Conditional named client check: ONLY display if actually named
  const rawNom = receiptData?.client?.nom?.trim();
  const isNamedClient = Boolean(
    rawNom &&
    !rawNom.toLowerCase().includes('passager') &&
    !rawNom.toLowerCase().includes('comptant') &&
    rawNom.toLowerCase() !== 'client inconnu'
  );
  const clientName = isNamedClient ? rawNom : '';

  const totalHt = Number(receiptData?.total_ht) || 0;
  const montantVerse = Number(receiptData?.montant_verse) || 0;
  const monnaieRendue = Number(receiptData?.monnaie_rendue) || 0;
  const detteVente = Number(receiptData?.dette_vente) || 0;
  const nouveauSolde = Number(receiptData?.nouveau_solde) || 0;

  // Trigger print routine
  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    setPrintStatus('Impression...');

    try {
      // @ts-ignore
      if (window.api && typeof window.api.printReceipt === 'function') {
        // @ts-ignore
        const res = await window.api.printReceipt({ silent: false });
        if (res && res.success === false && res.error) {
          console.warn('Native print returned error/canceled:', res.error);
        }
      } else {
        window.print();
      }

      setPrintStatus('OK !');
      setTimeout(() => {
        setPrintStatus(null);
        if (onPrinted) onPrinted();
        onClose();
      }, 400);
    } catch (err: any) {
      console.error('Print error:', err);
      try {
        window.print();
      } catch (e) {
        console.error('Window print fallback failed:', e);
      }
      onClose();
    } finally {
      setIsPrinting(false);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 select-none no-print-backdrop animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-[340px] max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-300 text-gray-900 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Toolbar */}
        <div className="bg-gray-900 text-white px-3 py-2 flex items-center justify-between shrink-0 border-b border-gray-800">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🧾</span>
            <span className="text-xs font-black uppercase tracking-wider text-gray-100">
              Aperçu Ticket
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
            title="Fermer (Échap)"
          >
            ✕
          </button>
        </div>

        {/* Ultra-Minimal Thermal Receipt Body (Zero Filler, Zero Decorative Waste) */}
        <div 
          id="thermal-receipt-print-area"
          className="flex-1 overflow-y-auto p-3.5 bg-white font-mono text-gray-950 text-xs leading-snug"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {/* 1. Store Name & Timestamp */}
          <div className="text-center pb-0.5">
            <h1 className="font-black text-xs uppercase tracking-wider text-black">
              GESTION STOCK PRO
            </h1>
            <div className="flex justify-between items-center text-[10px] text-gray-700 mt-0.5">
              <span>{safeDate()}</span>
              <span className="font-bold">#TKT-{saleId}</span>
            </div>
          </div>

          {/* 2. Client Name (ONLY if an actual named client is selected) */}
          {isNamedClient && (
            <div className="flex justify-between items-baseline text-[10px] text-gray-900 border-t border-dashed border-gray-400 pt-0.5 mt-0.5">
              <span className="font-semibold text-gray-600">Client:</span>
              <span className="font-bold truncate max-w-[200px]">{clientName}</span>
            </div>
          )}

          {/* 3. Single clean separator line above items */}
          <div className="border-t border-dashed border-gray-400 my-1"></div>

          {/* Purchased Products Table */}
          <div className="divide-y divide-dotted divide-gray-200">
            {items.length === 0 ? (
              <div className="py-1 text-center text-gray-400 italic text-[10px]">
                (Aucun article)
              </div>
            ) : (
              items.map((item, idx) => {
                const itemName = item?.nom || 'Article';
                const qty = Number(item?.quantite) || 1;
                const pu = Number(item?.prix_vente) || 0;
                const tot = Number(item?.total_ligne) || (qty * pu);

                return (
                  <div key={idx} className="py-0.5 text-[10.5px]">
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="font-bold truncate text-black leading-tight">{itemName}</span>
                      <span className="font-black text-black shrink-0 font-mono">
                        {tot.toFixed(2)} DA
                      </span>
                    </div>
                    <div className="text-[9px] text-gray-500 font-mono">
                      {qty} x {pu.toFixed(2)} DA
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 4. Single clean separator line above summary */}
          <div className="border-t border-dashed border-gray-400 my-1"></div>

          {/* Summary & Totals (Strict Essentials) */}
          <div className="space-y-0.5 text-[10.5px]">
            <div className="flex justify-between text-xs font-black text-black pt-0.5">
              <span>TOTAL:</span>
              <span className="font-mono">{formatMoney(totalHt)}</span>
            </div>

            {montantVerse > 0 && (
              <div className="flex justify-between text-gray-800">
                <span>Versé:</span>
                <span className="font-mono">{formatMoney(montantVerse)}</span>
              </div>
            )}

            {monnaieRendue > 0 && (
              <div className="flex justify-between font-bold text-gray-800">
                <span>Rendu:</span>
                <span className="font-mono">{formatMoney(monnaieRendue)}</span>
              </div>
            )}

            {detteVente > 0 && (
              <div className="flex justify-between font-bold text-red-700">
                <span>Reste/Crédit:</span>
                <span className="font-mono">+{formatMoney(detteVente)}</span>
              </div>
            )}

            {nouveauSolde > 0 && detteVente !== nouveauSolde && (
              <div className="flex justify-between font-bold text-black border-t border-dotted border-gray-300 pt-0.5 mt-0.5">
                <span>Solde dette:</span>
                <span className="font-mono">{formatMoney(nouveauSolde)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-2.5 bg-gray-100 border-t border-gray-200 flex flex-col gap-1.5 shrink-0">
          {printStatus && (
            <p className="text-center text-[11px] font-bold text-blue-700 animate-pulse">
              {printStatus}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPrinting}
              onClick={handlePrint}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🖨️</span>
              <span>{isPrinting ? 'Impression...' : 'Imprimer (Entrée)'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-white hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl border border-gray-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Fermer (Échap)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
