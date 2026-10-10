import { useState, useEffect, useRef, useCallback } from 'react';
import type { Participant } from '../types';

interface UseSpeechSynthesisOptions {
  language?: 'English' | 'Hindi';
}

export function useSpeechSynthesis({ language = 'English' }: UseSpeechSynthesisOptions = {}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);

  const voiceMapRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map());

  // Clear cached voice mappings when language changes
  useEffect(() => {
    voiceMapRef.current.clear();
  }, [language]);

  // Load available browser voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
      }
    };

    updateVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Assign distinct voices to participants based on language & persona
  const getVoiceForParticipant = useCallback((participant: Participant): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    const cacheKey = `${participant.id}-${language}`;
    if (voiceMapRef.current.has(cacheKey)) {
      return voiceMapRef.current.get(cacheKey)!;
    }

    // Filter by selected language
    const langPrefix = language === 'Hindi' ? 'hi' : 'en';
    const languageVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
    const pool = languageVoices.length > 0 ? languageVoices : voices;

    // Try finding gender matches by name hints (e.g. David, Mark, George, Samantha, Zira, Susan)
    const femaleHints = ['female', 'samantha', 'zira', 'susan', 'karen', 'victoria', 'natural (female)', 'kalpana', 'swara'];
    const maleHints = ['male', 'david', 'mark', 'george', 'guy', 'daniel', 'natural (male)', 'madhav', 'hemant'];

    let matchedVoice: SpeechSynthesisVoice | undefined;

    if (participant.voiceConfig.genderPreference === 'female') {
      matchedVoice = pool.find(v =>
        femaleHints.some(h => v.name.toLowerCase().includes(h))
      );
    } else if (participant.voiceConfig.genderPreference === 'male') {
      matchedVoice = pool.find(v =>
        maleHints.some(h => v.name.toLowerCase().includes(h))
      );
    }

    // Fallback: pick a voice with an offset based on participant index
    if (!matchedVoice) {
      const idx = Math.abs(hashCode(participant.id)) % pool.length;
      matchedVoice = pool[idx];
    }

    if (matchedVoice) {
      voiceMapRef.current.set(cacheKey, matchedVoice);
    }

    return matchedVoice || pool[0] || null;
  }, [voices, language]);

  const speak = useCallback(
    (
      text: string,
      participant: Participant,
      onStart?: () => void,
      onEnd?: () => void
    ) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        if (onEnd) onEnd();
        return;
      }

      // Cancel any ongoing utterance before speaking new text
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = getVoiceForParticipant(participant);

      if (voice) {
        utterance.voice = voice;
      }

      // Dynamic Speech API Configuration: Set utterance.lang = selectedLanguage === 'Hindi' ? 'hi-IN' : 'en-IN'
      utterance.lang = language === 'Hindi' ? 'hi-IN' : 'en-IN';
      utterance.pitch = participant.voiceConfig.pitch;
      utterance.rate = participant.voiceConfig.rate;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setCurrentSpeaker(participant.name);
        if (onStart) onStart();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentSpeaker(null);
        if (onEnd) onEnd();
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        setIsSpeaking(false);
        setCurrentSpeaker(null);
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    },
    [getVoiceForParticipant, language]
  );

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setCurrentSpeaker(null);
    }
  }, []);

  return {
    voices,
    isSpeaking,
    currentSpeaker,
    speak,
    cancel,
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
