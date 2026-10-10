import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Square,
  Clock,
  Send,
  AlertTriangle,
  RotateCw,
  Hand,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { Participant, Message, SessionConfig, FeedbackReportData } from '../types';
import { useGDArenaSession } from '../hooks/useGDArenaSession';
import { Soundwave } from './Soundwave';

interface ArenaProps {
  config: SessionConfig;
  onSessionComplete: (report: FeedbackReportData, transcript: Message[]) => void;
  onExitSession: () => void;
}

export const Arena: React.FC<ArenaProps> = ({
  config,
  onSessionComplete,
}) => {
  const [textInput, setTextInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  const {
    transcript,
    activeSpeaker,
    preparingSpeaker,
    status,
    timeRemaining,
    userIsMuted,
    isGeneratingFeedback,
    interimTranscript,
    permissionDenied,
    startSession,
    toggleMute,
    forceAIToSpeak,
    submitTextTurn,
    endSession,
  } = useGDArenaSession({
    config,
    onSessionComplete,
  });

  // Start the session on mount
  useEffect(() => {
    startSession();
  }, [startSession]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (autoScroll && transcriptBottomRef.current) {
      transcriptBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, interimTranscript, autoScroll]);

  // Format countdown mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Timer warning colors
  const timerColor =
    timeRemaining < 60
      ? 'text-rose-400 border-rose-500/40 bg-rose-500/10'
      : timeRemaining < 180
      ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
      : 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10';

  const isUserSpeaking = activeSpeaker === config.userName || Boolean(interimTranscript);
  const isFloorOpen = !activeSpeaker && !interimTranscript && status !== 'ai_thinking';

  // Combine user and AI participants for room visualization
  const userParticipant: Participant = {
    id: 'user',
    name: config.userName,
    role: 'Candidate (You)',
    description: 'Lead discussant and candidate',
    avatar: '🎙️',
    color: 'from-emerald-500 to-teal-600',
    glowColor: '#10B981',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    voiceConfig: { pitch: 1, rate: 1 },
    promptInstruction: '',
    isUser: true,
  };

  const allDiscussants = [userParticipant, ...config.selectedPersonalities];

  const handleManualTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    submitTextTurn(textInput);
    setTextInput('');
  };

  const handleRaiseHand = () => {
    setHasRaisedHand(prev => !prev);
    // If user raises hand, trigger next turn or take the floor
    if (!hasRaisedHand) {
      forceAIToSpeak();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Banner: GD Room Header & Controls */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Live Arena
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <h2 className="text-sm font-semibold text-slate-200 truncate max-w-md sm:max-w-xl" title={config.topic}>
            {config.topic}
          </h2>
        </div>

        {/* Timer & Primary Session Actions */}
        <div className="flex items-center gap-2.5">
          {/* Countdown Clock */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-sm font-bold shadow-sm transition-colors ${timerColor}`}
            title="Session time remaining"
          >
            <Clock className="w-4 h-4" />
            <span>{formatTime(timeRemaining)}</span>
          </div>

          {/* End GD Button */}
          <button
            onClick={endSession}
            disabled={isGeneratingFeedback}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{isGeneratingFeedback ? 'Evaluating...' : 'End GD & Get Report'}</span>
          </button>
        </div>
      </div>

      {/* Permission Denied Fallback Banner */}
      {permissionDenied && (
        <div className="px-4 py-2.5 bg-amber-950/80 border-b border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Microphone access is blocked. <strong>You can still speak via the Text Input bar below!</strong> To enable voice, click the lock/camera icon in your browser address bar.
            </span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-medium shrink-0"
          >
            Retry Mic
          </button>
        </div>
      )}

      {/* Main Split: Arena Visualization (Top) + Scrolling Transcript (Bottom) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Top: Circular Discussion Room Pod */}
        <div className="flex-1 relative flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden bg-radial from-slate-900/60 via-slate-950 to-slate-950">
          {/* Ambient Arena Glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />

          {/* Center Pod: Active State & Equalizer */}
          <div className="relative z-10 text-center max-w-md mb-6 sm:mb-8">
            {/* Dynamic Status Pill */}
            {isFloorOpen ? (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 text-xs font-bold text-emerald-300 animate-pulse mb-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <span>Floor is Open — Jump in!</span>
              </div>
            ) : activeSpeaker ? (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/40 shadow-lg text-xs font-semibold text-indigo-300 mb-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <span>
                  {activeSpeaker === config.userName
                    ? '🎙️ You have the floor (Speaking...)'
                    : `📢 ${activeSpeaker} is speaking (You can interrupt!)`}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 shadow-lg text-xs font-semibold text-amber-300 animate-pulse mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" />
                <span>
                  {preparingSpeaker
                    ? `✋ ${preparingSpeaker} is preparing to speak...`
                    : 'Participants are deliberating...'}
                </span>
              </div>
            )}

            {/* Active Soundwave */}
            <Soundwave
              isActive={Boolean(activeSpeaker)}
              color={isUserSpeaking ? 'bg-emerald-400' : 'bg-indigo-400'}
              size="lg"
            />
          </div>

          {/* Participant Avatars in Circular / Grid Layout */}
          <div className="relative z-10 w-full max-w-3xl">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 justify-items-center">
              {allDiscussants.map((participant) => {
                const isActive = activeSpeaker === participant.name || (participant.isUser && isUserSpeaking);
                const isUser = participant.isUser;
                const isPreparing = !isUser && preparingSpeaker === participant.name && status === 'ai_thinking';

                return (
                  <div
                    key={participant.id}
                    className={`relative flex flex-col items-center p-3.5 sm:p-4 rounded-2xl transition-all duration-300 w-full max-w-[185px] ${
                      isActive
                        ? 'bg-slate-800/90 shadow-2xl scale-105 border-2 border-indigo-400/80 shadow-indigo-500/20'
                        : isPreparing
                        ? 'bg-slate-800/70 border-2 border-amber-500/60 shadow-lg shadow-amber-500/15 scale-[1.02]'
                        : isUser && !userIsMuted
                        ? 'bg-slate-900/80 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-900/60 border border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Glowing active ring for speaking */}
                    {isActive && (
                      <span
                        className="absolute -inset-1 rounded-2xl opacity-60 blur-sm pointer-events-none"
                        style={{ backgroundColor: participant.glowColor }}
                      />
                    )}

                    {/* AI Intent to Speak: Hand Raised & Typing Indicator */}
                    {isPreparing && (
                      <div className="absolute -top-3 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/60 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 animate-pulse z-20">
                        <span>✋ Hand Raised</span>
                        <span className="flex gap-0.5 items-center">
                          <span className="w-1 h-1 bg-amber-300 rounded-full animate-bounce [animation-delay:0ms]"></span>
                          <span className="w-1 h-1 bg-amber-300 rounded-full animate-bounce [animation-delay:150ms]"></span>
                          <span className="w-1 h-1 bg-amber-300 rounded-full animate-bounce [animation-delay:300ms]"></span>
                        </span>
                      </div>
                    )}

                    {/* Avatar Container */}
                    <div className="relative mb-2.5">
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-inner border transition-all ${
                          isActive
                            ? 'ring-4 ring-offset-2 ring-offset-slate-950 ring-indigo-400 border-transparent bg-slate-800'
                            : isUser && !userIsMuted
                            ? 'ring-2 ring-offset-2 ring-offset-slate-950 ring-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.3)] border-emerald-500/50 bg-slate-800'
                            : isPreparing
                            ? 'ring-2 ring-offset-2 ring-offset-slate-950 ring-amber-400/80 border-amber-500/60 bg-slate-800'
                            : 'border-slate-700/60 bg-slate-800/80'
                        }`}
                        style={{
                          borderColor: isActive ? participant.glowColor : undefined,
                        }}
                      >
                        {participant.avatar}
                      </div>

                      {/* Small Live Mic / Speaking Pill */}
                      {isActive && (
                        <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-indigo-500 text-white shadow-md animate-bounce">
                          <Volume2 className="w-3 h-3" />
                        </div>
                      )}

                      {/* User Mute Badge */}
                      {isUser && userIsMuted && (
                        <div className="absolute -top-1 -right-1 p-1 rounded-full bg-rose-500 text-white shadow-md">
                          <MicOff className="w-3 h-3" />
                        </div>
                      )}

                      {/* User Live Mic Wave badge */}
                      {isUser && !userIsMuted && !isActive && (
                        <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-white shadow-md animate-pulse" title="Microphone is listening">
                          <Mic className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    {/* Participant Details */}
                    <div className="text-center w-full min-w-0">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                          {participant.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                        {participant.role.split('&')[0]}
                      </span>
                    </div>

                    {/* User Interruption Helper Badge */}
                    {isUser && (
                      <div className="mt-1">
                        {!userIsMuted ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-semibold text-emerald-400 animate-pulse">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Interrupt anytime</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-[9px] font-medium text-rose-400">
                            <span>Muted</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Micro Equalizer under avatar when active */}
                    <div className="mt-1.5 h-3 flex items-center">
                      <Soundwave
                        isActive={isActive || (isUser && !userIsMuted && !activeSpeaker)}
                        color={isUser ? 'bg-emerald-400' : isPreparing ? 'bg-amber-400' : 'bg-indigo-400'}
                        size="sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* In-Arena Floor Controls */}
          <div className="relative z-10 mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-3">
            {/* User Microphone Toggle */}
            <button
              onClick={toggleMute}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-lg ${
                userIsMuted
                  ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/50'
              }`}
              title={userIsMuted ? 'Unmute Microphone' : 'Microphone is active - interrupt anytime!'}
            >
              {userIsMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{userIsMuted ? 'Mic Muted' : 'Mic Active (Can Interrupt)'}</span>
            </button>

            {/* Force AI to Speak Button (Edge case solver) */}
            <button
              onClick={forceAIToSpeak}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-200 transition-all shadow-sm"
              title="Click if pause detection was missed or to pass the floor to an AI peer"
            >
              <RotateCw className="w-4 h-4 text-indigo-400" />
              <span>Force AI to Speak</span>
            </button>

            {/* Raise Hand Toggle */}
            <button
              onClick={handleRaiseHand}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-xs sm:text-sm font-medium transition-all shadow-sm ${
                hasRaisedHand
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Signal intent to speak or claim floor"
            >
              <Hand className="w-4 h-4 text-amber-400" />
              <span>{hasRaisedHand ? 'Hand Raised' : 'Raise Hand'}</span>
            </button>
          </div>
        </div>

        {/* Right / Bottom: Live Scrolling Transcript Drawer */}
        <div className="w-full lg:w-96 xl:w-[440px] flex flex-col bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 shrink-0">
          {/* Transcript Panel Header */}
          <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Live Transcript
              </h3>
              <span className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-400 rounded-full font-mono">
                {transcript.length} turns
              </span>
            </div>

            <button
              onClick={() => setAutoScroll(prev => !prev)}
              className={`text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                autoScroll ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white'
              }`}
            >
              {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            </button>
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs sm:text-sm">
            {transcript.map((msg) => {
              const isUser = msg.isUser;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col space-y-1 p-3 rounded-xl transition-all ${
                    isUser
                      ? 'bg-emerald-950/30 border border-emerald-500/30 ml-3'
                      : 'bg-slate-950/60 border border-slate-800/80 mr-3'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`font-bold ${
                        isUser ? 'text-emerald-400' : 'text-indigo-300'
                      }`}
                    >
                      {msg.speaker}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {msg.timestamp}
                    </span>
                  </div>
                  <p className="text-slate-200 leading-relaxed font-sans select-text">
                    "{msg.text}"
                  </p>
                </div>
              );
            })}

            {/* Interim Transcript (Real-time what the user is saying right now) */}
            {interimTranscript && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-400/50 rounded-xl ml-3 animate-pulse">
                <div className="flex items-center justify-between text-[11px] text-emerald-400 mb-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {config.userName} (Speaking now...)
                  </span>
                </div>
                <p className="text-emerald-200 italic leading-relaxed">
                  "{interimTranscript}..."
                </p>
              </div>
            )}

            <div ref={transcriptBottomRef} />
          </div>

          {/* Manual Text Fallback Input Bar */}
          <form
            onSubmit={handleManualTextSubmit}
            className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your point if mic is muted..."
              className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-40 transition-colors"
              title="Submit argument"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
