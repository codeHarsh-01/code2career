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

export const TURN_SEQUENCE: Array<'AI_1' | 'AI_2' | 'USER'> = ['AI_1', 'AI_2', 'USER'];

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
  const [preparingSpeaker, setPreparingSpeaker] = useState<string | null>(null);
  const [status, setStatus] = useState<ArenaStatus>('idle');
  const [timeRemaining, setTimeRemaining] = useState<number>(config.durationSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [userIsMuted, setUserIsMuted] = useState<boolean>(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState<boolean>(false);
  const [interruptionsHandled, setInterruptionsHandled] = useState<number>(0);

  // 1. Strict Turn-Based State Management:
  // Loop: AI 1 (index 0) -> AI 2 (index 1) -> User (index 2)
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [isWaitingForUser, setIsWaitingForUser] = useState<boolean>(false);

  const transcriptRef = useRef<Message[]>([]);
  transcriptRef.current = transcript;

  const isAITurnInProgressRef = useRef<boolean>(false);

  const { speak, cancel: cancelSpeech, isSpeaking: isAISpeaking } = useSpeechSynthesis();

  // 3. User Submission Handler (Unlocking the loop)
  const handleUserSubmission = useCallback((text: string) => {
    if (!text || text.trim().length === 0) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      speaker: config.userName,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isUser: true,
    };

    setTranscript(prev => [...prev, userMessage]);
    setIsWaitingForUser(false);
    setActiveSpeaker(null);
    setPreparingSpeaker(null);

    // Reset currentTurnIndex back to 0 (AI 1's turn)
    setCurrentTurnIndex(0);
  }, [config.userName]);

  // STT callback when user starts speaking
  const handleUserSpeechStart = useCallback(() => {
    if (isAISpeaking) {
      console.log('User interrupted AI speech! Yielding floor.');
      cancelSpeech();
      setInterruptionsHandled(prev => prev + 1);
    }
    setActiveSpeaker(config.userName);
  }, [isAISpeaking, cancelSpeech, config.userName]);

  // STT callback when user finishes speaking (pause detected)
  const handleUserSpeechComplete = useCallback((finalText: string) => {
    handleUserSubmission(finalText);
  }, [handleUserSubmission]);

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

  // 2. The Strict Conversation Loop via React useEffect:
  // AI 1 -> AI 2 -> User -> AI 1 -> AI 2 -> User ...
  useEffect(() => {
    if (!isTimerRunning) return;

    const currentTurn = TURN_SEQUENCE[currentTurnIndex];

    // CASE 1: When it is the User's turn (index 2)
    if (currentTurn === 'USER') {
      setIsWaitingForUser(true);
      setStatus('listening');
      setActiveSpeaker(null);
      setPreparingSpeaker(null);
      isAITurnInProgressRef.current = false;

      // Ensure microphone is listening if unmuted
      if (!userIsMuted) {
        startListening();
      }
      return; // Strictly halt all LLM API calls. The system pauses completely.
    }

    // CASE 2: When it is an AI's turn (index 0 for AI_1, index 1 for AI_2)
    setIsWaitingForUser(false);

    // Map AI_1 to first selected persona, AI_2 to second selected persona
    const ai1 = config.selectedPersonalities[0];
    const ai2 = config.selectedPersonalities[1] || config.selectedPersonalities[0];
    const currentAI = currentTurn === 'AI_1' ? ai1 : ai2;

    let isEffectActive = true;
    isAITurnInProgressRef.current = true;

    const executeAITurn = async () => {
      setStatus('ai_thinking');
      setPreparingSpeaker(currentAI.name);
      setActiveSpeaker(null);

      try {
        // Trigger the LLM API to generate a response for this specific AI
        const response = await getNextSpeakerTurn(
          config.topic,
          config.selectedPersonalities,
          transcriptRef.current,
          undefined,
          currentAI
        );

        if (!isEffectActive) return;

        const aiMessage: Message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          speaker: currentAI.name,
          text: response.dialogue,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          isUser: false,
          personalityId: currentAI.id,
        };

        // Append to transcript
        setTranscript(prev => [...prev, aiMessage]);
        setStatus('ai_speaking');
        setActiveSpeaker(currentAI.name);
        setPreparingSpeaker(null);

        // Speak using TTS
        speak(
          response.dialogue,
          currentAI,
          () => {
            if (isEffectActive) {
              setActiveSpeaker(currentAI.name);
              setStatus('ai_speaking');
            }
          },
          () => {
            // Once TTS finishes speaking, automatically increment currentTurnIndex
            if (isEffectActive) {
              setActiveSpeaker(null);
              setPreparingSpeaker(null);
              setStatus('idle');
              isAITurnInProgressRef.current = false;

              // Automatically advance to the next turn in sequence (0 -> 1 -> 2)
              setCurrentTurnIndex(prev => (prev + 1) % TURN_SEQUENCE.length);
            }
          }
        );
      } catch (err) {
        console.error('Error during AI turn:', err);
        if (isEffectActive) {
          setStatus('idle');
          setActiveSpeaker(null);
          setPreparingSpeaker(null);
          isAITurnInProgressRef.current = false;
          // Advance on error to prevent deadlock
          setCurrentTurnIndex(prev => (prev + 1) % TURN_SEQUENCE.length);
        }
      }
    };

    executeAITurn();

    return () => {
      isEffectActive = false;
    };
  }, [
    currentTurnIndex,
    isTimerRunning,
    config.topic,
    config.selectedPersonalities,
    userIsMuted,
    startListening,
    speak,
  ]);

  // Manual text submission from chat input
  const submitTextTurn = useCallback((text: string) => {
    handleUserSubmission(text);
  }, [handleUserSubmission]);

  // "Force AI to Speak" / Skip user turn if user passes
  const forceAIToSpeak = useCallback(() => {
    const pendingText = flushCurrentSpeech();
    if (pendingText && pendingText.trim().length > 0) {
      handleUserSubmission(pendingText);
    } else if (isWaitingForUser) {
      // User passes floor; unlock loop and jump back to AI_1
      setIsWaitingForUser(false);
      setCurrentTurnIndex(0);
    }
  }, [flushCurrentSpeech, handleUserSubmission, isWaitingForUser]);

  // Session start lifecycle
  const startSession = useCallback(() => {
    setIsTimerRunning(true);
    setTranscript([]);
    setCurrentTurnIndex(0); // Starts at AI_1
    setIsWaitingForUser(false);

    if (!userIsMuted) {
      startListening();
    }
  }, [userIsMuted, startListening]);

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

    setIsGeneratingFeedback(true);
    setStatus('idle');
    setActiveSpeaker(null);
    setPreparingSpeaker(null);

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
  }, [
    config.durationSeconds,
    config.topic,
    config.userName,
    timeRemaining,
    stopListening,
    cancelSpeech,
    onSessionComplete,
  ]);

  // 10-minute session timer
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
    preparingSpeaker,
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
    currentTurnIndex,
    isWaitingForUser,
    turnSequence: TURN_SEQUENCE,
    startSession,
    toggleMute,
    forceAIToSpeak,
    submitTextTurn,
    endSession,
  };
}
