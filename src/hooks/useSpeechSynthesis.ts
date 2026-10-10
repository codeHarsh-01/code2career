import { useState, useEffect, useRef, useCallback } from 'react';
import type { Participant } from '../types';

export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);

  const voiceMapRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map());

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

  // Assign distinct voices to participants
  const getVoiceForParticipant = useCallback((participant: Participant): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    if (voiceMapRef.current.has(participant.id)) {
      return voiceMapRef.current.get(participant.id)!;
    }

    // Filter English voices first
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    const pool = englishVoices.length > 0 ? englishVoices : voices;

    // Try finding gender matches by name hints (e.g. David, Mark, George, Samantha, Zira, Susan)
    const femaleHints = ['female', 'samantha', 'zira', 'susan', 'karen', 'victoria', 'natural (female)'];
    const maleHints = ['male', 'david', 'mark', 'george', 'guy', 'daniel', 'natural (male)'];

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
      voiceMapRef.current.set(participant.id, matchedVoice);
    }

    return matchedVoice || pool[0] || null;
  }, [voices]);

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
    [getVoiceForParticipant]
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
