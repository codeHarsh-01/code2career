import React, { useState } from 'react';
import {
  Mic,
  Users,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ShieldCheck,
  Zap,
  Play,
  Volume2,
  Languages,
} from 'lucide-react';
import { PRESET_TOPICS } from '../constants/topics';
import { AI_PERSONALITIES } from '../constants/personalities';
import type { Participant, SessionConfig, DiscussionLanguage } from '../types';

interface SetupScreenProps {
  onStartSession: (config: SessionConfig) => void;
  onOpenApiKeyModal: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
  onStartSession,
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(PRESET_TOPICS[0].id);
  const [customTopicText, setCustomTopicText] = useState<string>('');
  const [participantCount, setParticipantCount] = useState<number>(3);
  const [userName, setUserName] = useState<string>('Candidate');
  const [selectedLanguage, setSelectedLanguage] = useState<DiscussionLanguage>('English');
  const [isRequestingMic, setIsRequestingMic] = useState<boolean>(false);

  const isCustomTopic = selectedTopicId === 'custom';
  const activeTopic = isCustomTopic
    ? customTopicText.trim() || 'Custom Group Discussion Topic'
    : PRESET_TOPICS.find((t) => t.id === selectedTopicId)?.title || PRESET_TOPICS[0].title;

  // Select the subset of AI personalities based on count
  const selectedPersonalities: Participant[] = AI_PERSONALITIES.slice(0, participantCount);

  // Request mic permission and start GD
  const handleStartGD = async () => {
    setIsRequestingMic(true);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the probe stream immediately
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (err) {
      console.warn('Microphone permission not granted yet:', err);
      // Even if mic is denied initially, allow entry to Arena because we have a built-in text chat fallback!
    } finally {
      setIsRequestingMic(false);
    }

    const config: SessionConfig = {
      topic: activeTopic,
      aiCount: participantCount,
      userName: userName.trim() || 'Candidate',
      selectedPersonalities,
      durationSeconds: 600, // 10 minutes session
      language: selectedLanguage,
    };

    onStartSession(config);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 animate-fadeIn">
      {/* Hero Header */}
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
          <Zap className="w-3.5 h-3.5" />
          <span>Real-time Voice Group Discussion Practice</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          Step Into The <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">GD Arena</span>
        </h1>
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed">
          Sharpen your leadership, persuasive speech, and interrupt-handling skills against 
          diverse AI personalities in a simulated voice-first group discussion.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Configuration Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Topic Selection */}
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <MessageSquare className="w-4 h-4" />
              <span>Select GD Topic</span>
            </div>

            <div className="space-y-3">
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium">
                Choose from Presets or Enter Custom
              </label>

              <div className="relative">
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="w-full appearance-none px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer pr-10"
                >
                  {PRESET_TOPICS.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.category}: {topic.title}
                    </option>
                  ))}
                  <option value="custom">✨ Enter Custom Topic...</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {isCustomTopic ? (
                <div className="space-y-1.5 pt-1 animate-fadeIn">
                  <label className="block text-xs text-indigo-300">
                    Your Custom Discussion Prompt:
                  </label>
                  <textarea
                    rows={3}
                    value={customTopicText}
                    onChange={(e) => setCustomTopicText(e.target.value)}
                    placeholder="e.g., Should central banks replace cash with Central Bank Digital Currencies (CBDCs)?"
                    className="w-full px-4 py-3 bg-slate-950 border border-indigo-500/50 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                  />
                </div>
              ) : (
                <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-slate-300 leading-relaxed">
                  <span className="font-semibold text-indigo-300">Context: </span>
                  {PRESET_TOPICS.find((t) => t.id === selectedTopicId)?.context}
                </div>
              )}
            </div>
          </div>

          {/* Card: Discussion Language Selection */}
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <Languages className="w-4 h-4" />
                <span>Discussion Language</span>
              </div>
              <span className="text-xs px-2.5 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full font-mono">
                {selectedLanguage === 'Hindi' ? '🇮🇳 Hindi (hi-IN)' : '🌐 English (en-IN)'}
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium">
                Select Speech & LLM Language Engine
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('English')}
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                    selectedLanguage === 'English'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/40'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  <span className="text-base">🌐</span>
                  <span>English</span>
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300">en-IN</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLanguage('Hindi')}
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                    selectedLanguage === 'Hindi'
                      ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/30 ring-2 ring-amber-500/40'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  <span className="text-base">🇮🇳</span>
                  <span>Hindi (हिंदी)</span>
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300">hi-IN</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                {selectedLanguage === 'Hindi'
                  ? '🤖 AI participants will speak in Hindi (Devanagari script). Web Speech STT and TTS calibrated to hi-IN.'
                  : '🤖 AI participants will debate in English. Web Speech STT and TTS calibrated to en-IN.'}
              </p>
            </div>
          </div>

          {/* Card: AI Participants & Candidate Setup */}
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <Users className="w-4 h-4" />
                <span>AI Participants</span>
              </div>
              <span className="text-xs px-2.5 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full font-mono">
                {participantCount} AI Peers + You
              </span>
            </div>

            {/* Counter Selector */}
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium">
                Number of AI Discussants (3 to 5 AI Panel + Moderator)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {[2, 3, 4, 5, 6].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setParticipantCount(count)}
                    className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                      participantCount === count
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    {count} AI
                  </button>
                ))}
              </div>
            </div>

            {/* Candidate Name Input */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium">
                Your Display Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g., Alex / Candidate"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleStartGD}
              disabled={isRequestingMic}
              className="w-full group relative flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-base rounded-2xl shadow-xl shadow-indigo-600/30 hover:shadow-indigo-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
            >
              <Mic className="w-5 h-5 text-indigo-200 group-hover:scale-110 transition-transform" />
              <span>
                {isRequestingMic ? 'Checking Microphone...' : 'Start Group Discussion'}
              </span>
              <Play className="w-4 h-4 fill-current ml-1" />
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                100% Client-side Audio. Native Web Speech API STT/TTS requires no external audio uploads.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Participant Lineup Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Room Lineup & Personalities</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Active in Arena
              </span>
            </div>

            <div className="space-y-3">
              {/* User Card */}
              <div className="flex items-start gap-3 p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-lg font-bold border border-emerald-500/40 shrink-0">
                  🎙️
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">
                      {userName || 'Candidate'} (You)
                    </span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md">
                      Candidate
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/80 mt-0.5">
                    Evaluated on Idea Quality, Listening Skills, and Interruption Control.
                  </p>
                </div>
              </div>

              {/* AI Participant Cards */}
              {selectedPersonalities.map((ai) => (
                <div
                  key={ai.id}
                  className="flex items-start gap-3 p-3 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-xl transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0 border border-slate-700/60">
                    {ai.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold text-slate-100 truncate">
                        {ai.name}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${ai.badgeColor}`}>
                        {ai.role.split('&')[0]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                      {ai.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Voice notice */}
            <div className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl flex items-center gap-2.5 text-xs text-slate-400">
              <Volume2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Each AI is synthesized with distinct vocal pitch, rate, and speech styles.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
