import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore, type Product } from './store';

export const StockView = () => {
  const { products, fetchProducts, addProduct, editProduct, removeProduct, adjustProductStock, seedDemoData, isLoading } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'alert' | 'out'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(10);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Statistics
  const stats = useMemo(() => {
    const totalArticles = products.length;
    const totalUnits = products.reduce((acc, p) => acc + (p.stock_actuel || 0), 0);
    const lowStockCount = products.filter(p => p.stock_actuel <= p.seuil_alerte && p.stock_actuel > 0).length;
    const outOfStockCount = products.filter(p => p.stock_actuel <= 0).length;
    const totalValueAchat = products.reduce((acc, p) => acc + (p.stock_actuel * p.prix_achat), 0);
    const totalValueVente = products.reduce((acc, p) => acc + (p.stock_actuel * p.prix_gros), 0);

    return { totalArticles, totalUnits, lowStockCount, outOfStockCount, totalValueAchat, totalValueVente };
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.nom.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.code_barre.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterMode === 'alert') {
        return p.stock_actuel <= p.seuil_alerte;
      }
      if (filterMode === 'out') {
        return p.stock_actuel <= 0;
      }
      return true;
    });
  }, [products, searchQuery, filterMode]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number, nom: string) => {
    if (window.confirm(`Confirmez-vous la suppression du produit "${nom}" ?`)) {
      await removeProduct(id);
    }
  };

  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockAdjustProduct) return;
    await adjustProductStock(stockAdjustProduct.id, adjustAmount);
    setStockAdjustProduct(null);
  };

  return (
    <div className="flex-1 flex flex-col p-2.5 overflow-hidden bg-gray-100 w-full h-full">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-1.5">
            <span>📦</span> Inventaire & Gestion des Stocks
          </h1>
          <p className="text-xs text-gray-500">Suivi en temps réel des quantités, prix et alertes de réapprovisionnement</p>
        </div>

        <div className="flex items-center gap-2">
          {products.length === 0 && (
            <button
              onClick={() => seedDemoData()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold shadow-xs transition-colors text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>⚡</span> Charger Démo
            </button>
          )}
          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold shadow-xs transition-colors text-xs flex items-center gap-1 cursor-pointer"
          >
            <span>+</span> Nouveau Produit
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        <div className="bg-white p-2.5 px-3 rounded-lg shadow-xs border border-gray-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Références Totales</p>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-black text-gray-900">{stats.totalArticles}</span>
            <span className="text-xs text-gray-500 font-medium">{stats.totalUnits} unités</span>
          </div>
        </div>

        <div className="bg-white p-2.5 px-3 rounded-lg shadow-xs border border-gray-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Alertes Stock Faible</p>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className={`text-lg font-black ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {stats.lowStockCount}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
              ≤ seuil
            </span>
          </div>
        </div>

        <div className="bg-white p-2.5 px-3 rounded-lg shadow-xs border border-gray-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Ruptures de Stock</p>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className={`text-lg font-black ${stats.outOfStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {stats.outOfStockCount}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-800 font-bold">
              0 unité
            </span>
          </div>
        </div>

        <div className="bg-white p-2.5 px-3 rounded-lg shadow-xs border border-gray-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Valeur Totale (Gros)</p>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-black text-emerald-600 font-mono">{stats.totalValueVente.toLocaleString('fr-FR')} DA</span>
            <span className="text-[10px] text-gray-400 font-mono">Achat: {stats.totalValueAchat.toLocaleString('fr-FR')} DA</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="bg-white p-1.5 px-2 rounded-lg shadow-xs border border-gray-200 mb-2 flex items-center justify-between gap-3">
        <div className="flex-1 relative">
          <span className="absolute left-2.5 top-1.5 text-gray-400 text-xs">🔍</span>
          <input
            type="text"
            className="w-full pl-7 pr-3 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white text-gray-900"
            placeholder="Rechercher par désignation ou code-barre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-md">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded text-xs transition-all cursor-pointer ${
              filterMode === 'all' ? 'bg-white shadow-xs text-gray-900 font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Tous ({products.length})
          </button>
          <button
            onClick={() => setFilterMode('alert')}
            className={`px-2.5 py-1 rounded text-xs transition-all cursor-pointer ${
              filterMode === 'alert' ? 'bg-white shadow-xs text-amber-700 font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ⚠️ Alertes ({stats.lowStockCount})
          </button>
          <button
            onClick={() => setFilterMode('out')}
            className={`px-2.5 py-1 rounded text-xs transition-all cursor-pointer ${
              filterMode === 'out' ? 'bg-white shadow-xs text-red-700 font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🚫 Ruptures ({stats.outOfStockCount})
          </button>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="flex-1 bg-white rounded-lg shadow-xs border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="min-w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 sticky top-0 font-bold z-10 text-[11px]">
              <tr>
                <th className="py-2 px-2.5">Code-barre</th>
                <th className="py-2 px-2.5">Désignation</th>
                <th className="py-2 px-2.5 text-right">Stock Actuel</th>
                <th className="py-2 px-2.5 text-right">Seuil</th>
                <th className="py-2 px-2.5 text-right">Prix Achat</th>
                <th className="py-2 px-2.5 text-right">Prix Gros</th>
                <th className="py-2 px-2.5 text-right">Prix Détail</th>
                <th className="py-2 px-2.5 text-right">Marge Gros</th>
                <th className="py-2 px-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock_actuel <= 0;
                const isLowStock = p.stock_actuel <= p.seuil_alerte && !isOutOfStock;
                const margeGros = p.prix_gros - p.prix_achat;

                return (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-1.5 px-2.5 font-mono text-[11px] text-gray-500">
                      {p.code_barre || '-'}
                    </td>
                    <td className="py-1.5 px-2.5 font-bold text-gray-900 text-xs">
                      {p.nom}
                    </td>
                    <td className="py-1.5 px-2.5 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.2 rounded-full text-[11px] font-bold ${
                          isOutOfStock
                            ? 'bg-red-100 text-red-800'
                            : isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.stock_actuel} u
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 text-right text-gray-500 font-mono text-[11px]">
                      {p.seuil_alerte}
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono text-gray-700">
                      {p.prix_achat.toFixed(2)} DA
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-bold text-blue-700">
                      {p.prix_gros.toFixed(2)} DA
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono text-gray-800">
                      {p.prix_detail.toFixed(2)} DA
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono text-[11px] font-medium text-emerald-600">
                      +{margeGros.toFixed(2)} DA
                    </td>
                    <td className="py-1.5 px-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setStockAdjustProduct(p);
                            setAdjustAmount(10);
                          }}
                          className="px-1.5 py-0.5 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200 font-bold cursor-pointer"
                          title="Ajuster le stock"
                        >
                          ± Stock
                        </button>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="px-1.5 py-0.5 text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 font-bold cursor-pointer"
                          title="Modifier le produit"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.nom)}
                          className="px-1.5 py-0.5 text-[11px] bg-red-50 hover:bg-red-100 text-red-700 rounded border border-red-200 font-bold cursor-pointer"
                          title="Supprimer le produit"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-3xl">📦</span>
                      <p className="font-medium">Aucun produit trouvé dans cette vue.</p>
                      {products.length === 0 && (
                        <button
                          onClick={() => seedDemoData()}
                          className="mt-2 text-blue-600 hover:text-blue-800 underline text-sm"
                        >
                          Cliquez ici pour charger les produits de démonstration
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add / Edit Product */}
      {isModalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={() => setIsModalOpen(false)}
          onSave={async (formData) => {
            if (editingProduct) {
              await editProduct({ ...formData, id: editingProduct.id });
            } else {
              await addProduct(formData);
            }
            setIsModalOpen(false);
          }}
        />
      )}

      {/* Modal: Quick Stock Adjustment */}
      {stockAdjustProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-gray-900 border border-gray-200">
            <h3 className="text-lg font-bold mb-1">Ajustement du Stock</h3>
            <p className="text-sm text-gray-500 mb-4">{stockAdjustProduct.nom}</p>

            <form onSubmit={handleStockAdjustSubmit} className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Stock actuel:</span>
                  <span className="font-bold text-gray-800">{stockAdjustProduct.stock_actuel} unités</span>
                </div>
                <label className="block text-sm font-medium mb-1">Quantité à ajouter (ou déduire avec -) :</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    autoFocus
                    required
                    className="flex-1 border border-gray-300 rounded-lg p-2 text-lg font-bold text-center focus:ring-2 focus:ring-blue-500"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-2">
                {[5, 10, 20, 50, -5].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAdjustAmount(preset)}
                    className="flex-1 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 font-semibold"
                  >
                    {preset > 0 ? `+${preset}` : preset}
                  </button>
                ))}
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm flex justify-between">
                <span className="text-gray-600">Nouveau stock prévu:</span>
                <span className="font-black text-blue-700">
                  {Math.max(0, stockAdjustProduct.stock_actuel + adjustAmount)} unités
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockAdjustProduct(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Valider l'ajustement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductModal = ({
  product,
  onClose,
  onSave,
}: {
  product: Product | null;
  onClose: () => void;
  onSave: (data: Omit<Product, 'id'>) => Promise<void>;
}) => {
  const [nom, setNom] = useState(product?.nom || '');
  const [codeBarre, setCodeBarre] = useState(product?.code_barre || '');
  const [stockActuel, setStockActuel] = useState(product?.stock_actuel ?? 0);
  const [seuilAlerte, setSeuilAlerte] = useState(product?.seuil_alerte ?? 5);
  const [prixAchat, setPrixAchat] = useState(product?.prix_achat ?? 0);
  const [prixGros, setPrixGros] = useState(product?.prix_gros ?? 0);
  const [prixDetail, setPrixDetail] = useState(product?.prix_detail ?? 0);

  const generateBarcode = () => {
    const randomCode = '613' + Math.floor(100000000 + Math.random() * 900000000);
    setCodeBarre(randomCode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      nom,
      code_barre: codeBarre,
      stock_actuel: Number(stockActuel),
      seuil_alerte: Number(seuilAlerte),
      prix_achat: Number(prixAchat),
      prix_gros: Number(prixGros),
      prix_detail: Number(prixDetail),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg text-gray-900 border border-gray-200">
        <h2 className="text-xl font-bold mb-4">
          {product ? 'Modifier le Produit' : 'Nouveau Produit en Stock'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Désignation du produit *</label>
            <input
              type="text"
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              placeholder="ex: Huile Elio 5L, Sucre Cevital..."
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Code-barre</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm font-mono bg-white focus:ring-2 focus:ring-blue-500"
                placeholder="Scanner ou saisir..."
                value={codeBarre}
                onChange={(e) => setCodeBarre(e.target.value)}
              />
              <button
                type="button"
                onClick={generateBarcode}
                className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-100 font-semibold text-gray-700"
              >
                Générer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Stock Initial (unités)</label>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
                value={stockActuel}
                onChange={(e) => setStockActuel(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Seuil d'alerte mini</label>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
                value={seuilAlerte}
                onChange={(e) => setSeuilAlerte(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Prix Achat (DA)</label>
              <input
                type="number"
                min="0"
                step="any"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                value={prixAchat}
                onChange={(e) => setPrixAchat(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Prix Gros (DA) *</label>
              <input
                type="number"
                min="0"
                step="any"
                required
                className="w-full border border-blue-300 rounded-lg p-2.5 text-sm bg-blue-50/30 focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-900"
                value={prixGros}
                onChange={(e) => setPrixGros(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Prix Détail (DA)</label>
              <input
                type="number"
                min="0"
                step="any"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                value={prixDetail}
                onChange={(e) => setPrixDetail(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
