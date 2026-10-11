import React, { useState } from 'react';

interface ActivationLockScreenProps {
  machineId: string;
  onActivated: () => void;
}

export const ActivationLockScreen: React.FC<ActivationLockScreenProps> = ({
  onActivated,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = password.trim();
    if (!trimmed) {
      setError("Veuillez saisir le mot de passe d'activation.");
      return;
    }

    setIsSubmitting(true);
    try {
      // @ts-ignore
      const result = await window.api.activateLicense(trimmed);
      if (result && result.success) {
        onActivated();
      } else {
        setError(
          result?.error || "Mot de passe d'activation incorrect."
        );
      }
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'activation du logiciel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-950 text-white flex flex-col items-center justify-center p-6 select-none relative">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-950/40 via-gray-950 to-gray-950 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Accent Banner */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600" />

        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-gray-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-xl shadow-inner">
              🔒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wide text-white uppercase">
                  Activation Requise
                </h1>
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-mono font-bold">
                  PRO
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                GestionStock — Déverrouillage du poste
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Instruction Notice */}
          <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl p-4 flex items-start gap-3">
            <span className="text-blue-400 text-base leading-none mt-0.5">ℹ️</span>
            <p className="text-xs text-blue-100/90 leading-relaxed font-medium">
              Veuillez saisir le mot de passe administrateur pour activer définitivement GestionStock sur cet ordinateur.
            </p>
          </div>

          {/* Activation Password Form */}
          <form onSubmit={handleActivate} className="space-y-4">
            <div>
              <label
                htmlFor="license-password-input"
                className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2"
              >
                Mot de passe d'Activation
              </label>
              <div className="relative flex items-center">
                <input
                  id="license-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Entrez le mot de passe d'activation..."
                  className="w-full bg-gray-950 border-2 border-gray-700 focus:border-blue-500 focus:outline-none rounded-xl pl-4 pr-12 py-3.5 font-mono text-sm sm:text-base font-bold tracking-wider text-white placeholder-gray-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 px-2 py-1 text-gray-400 hover:text-white text-xs font-semibold cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-950/60 border border-rose-700/60 rounded-xl px-4 py-3 flex items-center gap-2.5 text-rose-200 text-xs font-semibold">
                <span className="text-sm shrink-0">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Activation en cours...</span>
              ) : (
                <>
                  <span>🔓</span>
                  <span>Activer le Logiciel</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-3.5 bg-gray-950/80 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-500">
          <span>Protection Poste Client</span>
          <span>GestionStock PRO</span>
        </div>
      </div>
    </div>
  );
};
