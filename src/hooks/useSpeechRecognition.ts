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
  pauseThresholdMs?: number; // silence delay before committing turn (default: 1800ms)
  lang?: string;
}

export function useSpeechRecognition({
  onSpeechComplete,
  onSpeechStart,
  pauseThresholdMs = 1800,
  lang = 'en-US',
}: UseSpeechRecognitionOptions = {}) {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedTextRef = useRef<string>('');
  const shouldBeListeningRef = useRef<boolean>(false);
  const onSpeechCompleteRef = useRef(onSpeechComplete);
  const onSpeechStartRef = useRef(onSpeechStart);

  onSpeechCompleteRef.current = onSpeechComplete;
  onSpeechStartRef.current = onSpeechStart;

  // Update recognition language dynamically when lang changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, [lang]);

  // Initialize SpeechRecognition
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
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let currentInterim = '';
      let hasNewSpeech = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const transcriptChunk = item[0].transcript;

        if (item.isFinal) {
          accumulatedTextRef.current += ' ' + transcriptChunk.trim();
          hasNewSpeech = true;
        } else {
          currentInterim += transcriptChunk;
          hasNewSpeech = true;
        }
      }

      setInterimTranscript(currentInterim);

      if (hasNewSpeech) {
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
            setInterimTranscript('');
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

    recognition.onend = () => {
      // Chrome often stops recognition after a pause; restart if user still wants to listen
      if (shouldBeListeningRef.current) {
        try {
          recognition.start();
        } catch {
          // Ignore if already active
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
    accumulatedTextRef.current = '';
    setInterimTranscript('');

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

  // Flush any pending text immediately (e.g. when user clicks Force Next or manually submits)
  const flushCurrentSpeech = useCallback((): string => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    const fullSpoken = (accumulatedTextRef.current + ' ' + interimTranscript).trim();
    accumulatedTextRef.current = '';
    setInterimTranscript('');
    return fullSpoken;
  }, [interimTranscript]);

  return {
    isSupported,
    isListening,
    interimTranscript,
    error,
    permissionDenied,
    startListening,
    stopListening,
    flushCurrentSpeech,
  };
}
