import React from 'react';
import { Key, Radio, Volume2 } from 'lucide-react';
import { getStoredApiKey } from '../services/llm';

interface NavbarProps {
  onOpenApiKeyModal: () => void;
  inSession?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenApiKeyModal }) => {
  const hasApiKey = Boolean(getStoredApiKey());

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25">
            <Radio className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">
                GD <span className="text-indigo-400">Arena</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md">
                Voice AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Voice-First Group Discussion Practice Simulator
            </p>
          </div>
        </div>

        {/* Status Pills and Actions */}
        <div className="flex items-center gap-2.5">
          {/* Engine Status */}
          <button
            onClick={onOpenApiKeyModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              hasApiKey
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
            }`}
            title="Click to manage Groq API Key"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {hasApiKey ? 'Groq Llama 3.3 Active' : 'Simulation Mode'}
            </span>
            <span className="sm:hidden">
              {hasApiKey ? 'Groq' : 'Sim'}
            </span>
          </button>

          {/* Web Speech API indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Native STT & TTS</span>
          </div>

          {/* Settings Trigger */}
          <button
            onClick={onOpenApiKeyModal}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            aria-label="API Settings"
            title="Configure LLM & API Keys"
          >
            <Key className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
