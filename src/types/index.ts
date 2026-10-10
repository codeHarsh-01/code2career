export interface Message {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isUser: boolean;
  personalityId?: string;
}

export interface Participant {
  id: string;
  name: string;
  role: string;
  description: string;
  avatar: string;
  color: string;
  glowColor: string;
  badgeColor: string;
  voiceConfig: {
    pitch: number;
    rate: number;
    genderPreference?: 'male' | 'female';
  };
  promptInstruction: string;
  isUser: boolean;
}

export interface SessionConfig {
  topic: string;
  aiCount: number;
  userName: string;
  selectedPersonalities: Participant[];
  durationSeconds: number;
}

export interface MetricFeedback {
  score: number; // 0 to 10
  verdict: 'Excellent' | 'Good' | 'Needs Improvement' | 'Critical';
  analysis: string;
  quotes: Array<{
    quote: string;
    context: string;
    comment: string;
  }>;
}

export interface FeedbackReportData {
  candidateName: string;
  topic: string;
  durationMinutes: number;
  overallScore: number;
  verdict: string;
  executiveSummary: string;
  metrics: {
    ideaQuality: MetricFeedback;
    listeningSkills: MetricFeedback;
    handlingInterruptions: MetricFeedback;
  };
  keyStrengths: string[];
  areasForImprovement: string[];
  actionableTips: string[];
  participantStats: Array<{
    name: string;
    turns: number;
    wordCount: number;
  }>;
}

export type ArenaStatus = 'idle' | 'listening' | 'ai_thinking' | 'ai_speaking';
