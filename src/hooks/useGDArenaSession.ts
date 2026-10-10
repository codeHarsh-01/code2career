import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Message,
  SessionConfig,
  ArenaStatus,
  FeedbackReportData,
} from '../types';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeechSynthesis } from './useSpeechSynthesis';
import { getNextSpeakerTurn, generateFeedbackReport } from '../services/llm';

interface UseGDArenaSessionProps {
  config: SessionConfig;
  onSessionComplete: (report: FeedbackReportData, transcript: Message[]) => void;
}

export function useGDArenaSession({
  config,
  onSessionComplete,
}: UseGDArenaSessionProps) {
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [status, setStatus] = useState<ArenaStatus>('idle');
  const [timeRemaining, setTimeRemaining] = useState<number>(config.durationSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [userIsMuted, setUserIsMuted] = useState<boolean>(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState<boolean>(false);
  const [interruptionsHandled, setInterruptionsHandled] = useState<number>(0);

  const silencePromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAITurnInProgressRef = useRef<boolean>(false);
  const transcriptRef = useRef<Message[]>([]);
  transcriptRef.current = transcript;

  const { speak, cancel: cancelSpeech, isSpeaking: isAISpeaking } = useSpeechSynthesis();

  // Handle when user starts speaking while AI is speaking (Interruption event!)
  const handleUserSpeechStart = useCallback(() => {
    if (isAISpeaking) {
      console.log('User interrupted AI speech! Yielding floor to candidate.');
      cancelSpeech();
      setInterruptionsHandled(prev => prev + 1);
    }
    setActiveSpeaker(config.userName);
    setStatus('listening');

    // Clear any pending silence timer
    if (silencePromptTimerRef.current) {
      clearTimeout(silencePromptTimerRef.current);
    }
  }, [isAISpeaking, cancelSpeech, config.userName]);

  // Handle completed user utterance (pause detected)
  const handleUserSpeechComplete = useCallback((finalText: string) => {
    if (!finalText || finalText.trim().length === 0) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      speaker: config.userName,
      text: finalText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isUser: true,
    };

    setTranscript(prev => [...prev, userMessage]);
    setActiveSpeaker(null);

    // Trigger AI response to the user's input
    triggerAITurn(userMessage.speaker);
  }, [config.userName]);

  const {
    isSupported: isSpeechSupported,
    isListening,
    interimTranscript,
    error: speechError,
    permissionDenied,
    startListening,
    stopListening,
    flushCurrentSpeech,
  } = useSpeechRecognition({
    onSpeechComplete: handleUserSpeechComplete,
    onSpeechStart: handleUserSpeechStart,
    pauseThresholdMs: 1700,
  });

  // Orchestrate AI Turn
  const triggerAITurn = useCallback(async (lastSpeakerName?: string) => {
    if (isAITurnInProgressRef.current) return;
    isAITurnInProgressRef.current = true;

    setStatus('ai_thinking');
    setActiveSpeaker(null);

    try {
      const response = await getNextSpeakerTurn(
        config.topic,
        config.selectedPersonalities,
        transcriptRef.current,
        lastSpeakerName
      );

      const speakerPersona = config.selectedPersonalities.find(
        p => p.name.toLowerCase() === response.speaker.toLowerCase()
      ) || config.selectedPersonalities[0];

      const aiMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        speaker: speakerPersona.name,
        text: response.dialogue,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isUser: false,
        personalityId: speakerPersona.id,
      };

      setTranscript(prev => [...prev, aiMessage]);
      setStatus('ai_speaking');
      setActiveSpeaker(speakerPersona.name);

      // Speak aloud using Web Speech API TTS
      speak(
        response.dialogue,
        speakerPersona,
        () => {
          // On speech start
          setActiveSpeaker(speakerPersona.name);
          setStatus('ai_speaking');
        },
        () => {
          // On speech finish
          setActiveSpeaker(null);
          setStatus('idle');
          isAITurnInProgressRef.current = false;

          // If silence lingers for 8 seconds and user doesn't chime in, have another participant speak
          if (silencePromptTimerRef.current) clearTimeout(silencePromptTimerRef.current);
          silencePromptTimerRef.current = setTimeout(() => {
            if (!isAITurnInProgressRef.current) {
              triggerAITurn(speakerPersona.name);
            }
          }, 8000);
        }
      );
    } catch (err) {
      console.error('Failed AI turn:', err);
      setStatus('idle');
      setActiveSpeaker(null);
      isAITurnInProgressRef.current = false;
    }
  }, [config.topic, config.selectedPersonalities, speak]);

  // Manual trigger: "Force AI to Speak"
  const forceAIToSpeak = useCallback(() => {
    const pendingText = flushCurrentSpeech();
    if (pendingText && pendingText.trim().length > 0) {
      handleUserSpeechComplete(pendingText);
    } else {
      triggerAITurn();
    }
  }, [flushCurrentSpeech, handleUserSpeechComplete, triggerAITurn]);

  // Manual text fallback send (if mic is denied or noisy room)
  const submitTextTurn = useCallback((text: string) => {
    if (!text.trim()) return;
    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      speaker: config.userName,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isUser: true,
    };

    setTranscript(prev => [...prev, userMessage]);
    triggerAITurn(config.userName);
  }, [config.userName, triggerAITurn]);

  // Session start lifecycle
  const startSession = useCallback(() => {
    setIsTimerRunning(true);
    if (!userIsMuted) {
      startListening();
    }

    // Seed the discussion with the Moderator's opening remark
    const moderator = config.selectedPersonalities.find(p => p.id === 'moderator') || config.selectedPersonalities[0];
    const initialGreeting = `Good morning team. We have 10 minutes to discuss: "${config.topic}". Let's explore the key trade-offs and reach a constructive consensus. Who would like to open the floor?`;

    const seedMsg: Message = {
      id: `msg-seed-${Date.now()}`,
      speaker: moderator.name,
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isUser: false,
      personalityId: moderator.id,
    };

    setTranscript([seedMsg]);

    // Speak initial remark
    setTimeout(() => {
      speak(
        initialGreeting,
        moderator,
        () => {
          setActiveSpeaker(moderator.name);
          setStatus('ai_speaking');
        },
        () => {
          setActiveSpeaker(null);
          setStatus('idle');
        }
      );
    }, 600);
  }, [config.durationSeconds, config.topic, config.selectedPersonalities, userIsMuted, startListening, speak]);

  // Toggle user microphone
  const toggleMute = useCallback(() => {
    setUserIsMuted(prev => {
      const next = !prev;
      if (next) {
        stopListening();
      } else {
        startListening();
      }
      return next;
    });
  }, [startListening, stopListening]);

  // End Session and Generate Report
  const endSession = useCallback(async () => {
    setIsTimerRunning(false);
    stopListening();
    cancelSpeech();
    if (silencePromptTimerRef.current) clearTimeout(silencePromptTimerRef.current);

    setIsGeneratingFeedback(true);
    setStatus('idle');
    setActiveSpeaker(null);

    const elapsedSeconds = config.durationSeconds - timeRemaining;
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    try {
      const report = await generateFeedbackReport(
        config.topic,
        config.userName,
        transcriptRef.current,
        elapsedMinutes
      );
      onSessionComplete(report, transcriptRef.current);
    } catch (err) {
      console.error('Error generating final report:', err);
    } finally {
      setIsGeneratingFeedback(false);
    }
  }, [config.durationSeconds, config.topic, config.userName, timeRemaining, stopListening, cancelSpeech, onSessionComplete]);

  // Session 10-minute timer countdown
  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          endSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, endSession]);

  return {
    transcript,
    activeSpeaker,
    status,
    timeRemaining,
    isTimerRunning,
    userIsMuted,
    isGeneratingFeedback,
    isSpeechSupported,
    isListening,
    interimTranscript,
    speechError,
    permissionDenied,
    interruptionsHandled,
    startSession,
    toggleMute,
    forceAIToSpeak,
    submitTextTurn,
    endSession,
  };
}
