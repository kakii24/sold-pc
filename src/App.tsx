import React, { useEffect, useState } from 'react';
import { WholesaleView } from './WholesaleView';
import { RetailView } from './RetailView';
import { StockView } from './StockView';
import { ClientsView } from './ClientsView';
import { ActivationLockScreen } from './ActivationLockScreen';
import { useAppStore } from './store';

function App() {
  const [activeView, setActiveView] = useState<'wholesale' | 'retail' | 'stock' | 'clients'>('wholesale');
  const [licenseChecking, setLicenseChecking] = useState<boolean>(true);
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [machineId, setMachineId] = useState<string>('');

  const { products, clients, fetchProducts, fetchClients } = useAppStore();

  useEffect(() => {
    let mounted = true;
    const verifyLicense = async () => {
      try {
        // @ts-ignore
        if (window.api?.getLicenseStatus) {
          // @ts-ignore
          const status = await window.api.getLicenseStatus();
          if (mounted) {
            setMachineId(status?.machineId || '');
            setIsActivated(Boolean(status?.activated));
          }
        }
      } catch (err) {
        console.error('License verification error:', err);
      } finally {
        if (mounted) {
          setLicenseChecking(false);
        }
      }
    };
    verifyLicense();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isActivated) {
      fetchProducts();
      fetchClients();
    }
  }, [isActivated, fetchProducts, fetchClients]);

  const lowStockCount = products.filter(p => p.stock_actuel <= p.seuil_alerte).length;
  const indebtedClientsCount = clients.filter(c => c.total_dette > 0).length;

  useEffect(() => {
    if (!isActivated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveView('wholesale');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveView('retail');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveView('stock');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveView('clients');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActivated]);

  if (licenseChecking) {
    return (
      <div className="w-screen h-screen bg-gray-950 text-white flex flex-col items-center justify-center select-none">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">
          Vérification de la licence matérielle...
        </p>
      </div>
    );
  }

  if (!isActivated) {
    return (
      <ActivationLockScreen
        machineId={machineId}
        onActivated={() => setIsActivated(true)}
      />
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-100 font-sans flex flex-col">
      {/* Top Application Navbar (Compact h-11) */}
      <header className="h-11 bg-gray-900 text-white px-4 flex items-center justify-between border-b border-gray-800 shadow-xs select-none shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🏪</span>
            <span className="font-black text-sm tracking-wide text-white">GestionStock</span>
            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-mono font-bold">PRO</span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setActiveView('wholesale')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'wholesale'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span>🛒</span>
              <span>Vente en Gros</span>
              <kbd className="text-[10px] bg-black/40 px-1 py-0.2 rounded text-gray-300 font-mono">F1</kbd>
            </button>

            <button
              onClick={() => setActiveView('retail')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'retail'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span>⚡</span>
              <span>Vente au Détail</span>
              <kbd className="text-[10px] bg-black/40 px-1 py-0.2 rounded text-gray-300 font-mono">F2</kbd>
            </button>

            <button
              onClick={() => setActiveView('stock')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all relative cursor-pointer ${
                activeView === 'stock'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span>📦</span>
              <span>Gestion du Stock</span>
              <kbd className="text-[10px] bg-black/40 px-1 py-0.2 rounded text-gray-300 font-mono">F3</kbd>
              {lowStockCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[9px] bg-amber-500 text-black font-black rounded-full" title={`${lowStockCount} articles en stock faible`}>
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveView('clients')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all relative cursor-pointer ${
                activeView === 'clients'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span>👥</span>
              <span>Fiches Clients & Crédits</span>
              <kbd className="text-[10px] bg-black/40 px-1 py-0.2 rounded text-gray-300 font-mono">F4</kbd>
              {indebtedClientsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[9px] bg-rose-500 text-white font-black rounded-full shadow-xs" title={`${indebtedClientsCount} clients débiteurs`}>
                  {indebtedClientsCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {activeView === 'wholesale' && <WholesaleView />}
        {activeView === 'retail' && <RetailView />}
        {activeView === 'stock' && <StockView />}
        {activeView === 'clients' && <ClientsView />}
      </main>
    </div>
  );
}

export default App;
