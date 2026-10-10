import React, { useState, useEffect } from 'react';
import { Key, Sparkles, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey } from '../services/llm';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getStoredApiKey());
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setStoredApiKey(apiKey.trim());
    setStatusMessage('Key saved successfully! All GD turns will use Groq LLM.');
    onKeySaved(apiKey.trim());
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const handleClear = () => {
    setStoredApiKey('');
    setApiKey('');
    setStatusMessage('Cleared! App is running in zero-latency built-in Simulation Mode.');
    onKeySaved('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg p-6 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-indigo-950/40">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg transition-colors hover:bg-slate-800"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Groq API Configuration</h3>
            <p className="text-xs text-slate-400">
              Power ultra-fast LLM orchestration via Groq Cloud
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Enter your Groq API key (starts with <code className="px-1.5 py-0.5 bg-slate-800 text-indigo-300 rounded text-xs font-mono">gsk_...</code>).
            It is stored locally in your browser session and never sent to external servers.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Groq API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
            />
          </div>

          <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Zero-Config Simulation Fallback Active</span>
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              No key? Don't worry! GD Arena includes an intelligent offline simulation engine so you can demo the entire discussion and feedback loop instantly during the hackathon.
            </p>
          </div>

          {statusMessage && (
            <div className="flex items-center gap-2 p-3 text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              Reset to Simulation
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
