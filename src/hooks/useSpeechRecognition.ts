import { useState, useEffect, useRef, useCallback } from 'react';

// Extend window for webkitSpeechRecognition
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: {
      new (): SpeechRecognitionInstance;
    };
    webkitSpeechRecognition?: {
      new (): SpeechRecognitionInstance;
    };
  }
}

interface UseSpeechRecognitionOptions {
  onSpeechComplete?: (finalText: string) => void;
  onSpeechStart?: () => void;
  onFinalText?: (finalChunk: string) => void;
  pauseThresholdMs?: number; // silence delay before committing turn (default: 1800ms)
  lang?: string;
  isWaitingForUser?: boolean;
  userIsMuted?: boolean;
}

export function useSpeechRecognition({
  onSpeechComplete,
  onSpeechStart,
  onFinalText,
  pauseThresholdMs = 1800,
  lang = 'en-US',
  isWaitingForUser = false,
  userIsMuted = false,
}: UseSpeechRecognitionOptions = {}) {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [liveInterimText, setLiveInterimText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedTextRef = useRef<string>('');
  const shouldBeListeningRef = useRef<boolean>(false);
  const onSpeechCompleteRef = useRef(onSpeechComplete);
  const onSpeechStartRef = useRef(onSpeechStart);
  const onFinalTextRef = useRef(onFinalText);
  const isWaitingForUserRef = useRef<boolean>(isWaitingForUser);
  const userIsMutedRef = useRef<boolean>(userIsMuted);

  onSpeechCompleteRef.current = onSpeechComplete;
  onSpeechStartRef.current = onSpeechStart;
  onFinalTextRef.current = onFinalText;
  isWaitingForUserRef.current = isWaitingForUser;
  userIsMutedRef.current = userIsMuted;

  // Update recognition language dynamically when lang changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, [lang]);

  // Initialize SpeechRecognition with interimResults enabled
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      setError('Web Speech API (SpeechRecognition) is not supported in this browser. Please use Chrome, Edge, or Brave.');
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true; // 1. Enable Interim Results for real-time live typing
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    // 2. Separate States for Live and Final Text
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let currentInterim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const transcriptChunk = item[0].transcript;

        if (item.isFinal) {
          finalChunk += transcriptChunk;
        } else {
          currentInterim += transcriptChunk;
        }
      }

      // If result.isFinal is false, update liveInterimText state so we can show live typing
      if (currentInterim) {
        setLiveInterimText(currentInterim);
      }

      // If result.isFinal is true, take finalized text, append to actual input/transcript,
      // and immediately clear the liveInterimText state
      if (finalChunk) {
        const trimmed = finalChunk.trim();
        if (trimmed) {
          accumulatedTextRef.current = (accumulatedTextRef.current + ' ' + trimmed).trim();
          setLiveInterimText(''); // Immediately clear live interim text
          if (onFinalTextRef.current) {
            onFinalTextRef.current(trimmed);
          }
        }
      }

      if (currentInterim || finalChunk) {
        // Notify parent that user is actively speaking (for interruption handling)
        if (onSpeechStartRef.current) {
          onSpeechStartRef.current();
        }

        // Reset silence debounce timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        silenceTimerRef.current = setTimeout(() => {
          const fullSpoken = (accumulatedTextRef.current + ' ' + currentInterim).trim();
          if (fullSpoken.length > 2) {
            if (onSpeechCompleteRef.current) {
              onSpeechCompleteRef.current(fullSpoken);
            }
            accumulatedTextRef.current = '';
            setLiveInterimText('');
          }
        }, pauseThresholdMs);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setPermissionDenied(true);
        setError('Microphone access was denied. Please allow microphone permissions to speak.');
      } else if (event.error === 'no-speech') {
        // Normal silence timeout; do not show intrusive error
      } else {
        setError(`Speech recognition: ${event.error}`);
      }
    };

    // 4. Robust Restart Logic (Auto-Wake):
    // The Web Speech API drops frequently. In the onend event handler, check if it is still
    // the user's turn (isWaitingForUser === true). If it is, and the mic randomly disconnected
    // without the user submitting, automatically restart recognition (recognition.start())
    // so the mic doesn't silently die in the middle of their turn.
    recognition.onend = () => {
      const shouldAutoRestart =
        !userIsMutedRef.current &&
        (isWaitingForUserRef.current || shouldBeListeningRef.current);

      if (shouldAutoRestart) {
        try {
          recognition.start();
        } catch {
          // If browser is finishing audio release, auto-retry with debounce
          setTimeout(() => {
            try {
              if (!userIsMutedRef.current && (isWaitingForUserRef.current || shouldBeListeningRef.current)) {
                recognition.start();
              }
            } catch {
              // Ignore if already active
            }
          }, 150);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldBeListeningRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, [lang, pauseThresholdMs]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldBeListeningRef.current = true;
    setError(null);
    setPermissionDenied(false);

    try {
      recognitionRef.current.start();
    } catch {
      // In case it's already running
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const resetSpeechState = useCallback(() => {
    accumulatedTextRef.current = '';
    setLiveInterimText('');
  }, []);

  // Flush any pending text immediately (e.g. when user clicks Force Next or manually submits)
  const flushCurrentSpeech = useCallback((): string => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    const fullSpoken = (accumulatedTextRef.current + ' ' + liveInterimText).trim();
    accumulatedTextRef.current = '';
    setLiveInterimText('');
    return fullSpoken;
  }, [liveInterimText]);

  return {
    isSupported,
    isListening,
    liveInterimText,
    interimTranscript: liveInterimText, // Backward compatibility alias
    error,
    permissionDenied,
    startListening,
    stopListening,
    flushCurrentSpeech,
    resetSpeechState,
  };
}
