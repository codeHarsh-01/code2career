import type { Message, Participant, FeedbackReportData } from '../types';

export interface NextSpeakerResponse {
  speaker: string;
  dialogue: string;
}

export function getStoredApiKey(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('gd_arena_groq_key') || (import.meta as any).env?.VITE_GROQ_API_KEY || '';
  }
  return '';
}

export function setStoredApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gd_arena_groq_key', key.trim());
  }
}

/**
 * Calls Groq API (or OpenAI compatible) to orchestrate the next turn in the GD.
 */
export async function getNextSpeakerTurn(
  topic: string,
  participants: Participant[],
  transcript: Message[],
  lastSpeakerName?: string
): Promise<NextSpeakerResponse> {
  const apiKey = getStoredApiKey();

  // If no API key is provided, use the high-quality local simulated GD engine
  if (!apiKey) {
    return simulateNextTurn(topic, participants, transcript, lastSpeakerName);
  }

  const personalitiesDescription = participants
    .map(p => `- ${p.name} (${p.role}): ${p.promptInstruction}`)
    .join('\n');

  const transcriptHistory = transcript.length === 0
    ? '(No conversation yet. Moderator or another participant should initiate.)'
    : transcript
        .map(m => `${m.speaker}: "${m.text}"`)
        .join('\n');

  const systemPrompt = `You are simulating a realistic, professional Group Discussion (GD) room.
Topic: "${topic}"

The participants in the discussion are:
${personalitiesDescription}

Rules:
1. Act as the discussion orchestrator. Review the transcript history carefully.
2. Select ONE AI participant who should naturally speak next based on momentum, conflicting views, or to draw in quieter opinions.
3. Do NOT have the same speaker speak twice in a row if possible (Last speaker: ${lastSpeakerName || 'None'}).
4. Generate their exact dialogue in direct reaction to what was just said. Address or respectfully challenge the Candidate (User) or other peers directly when appropriate.
5. Keep responses concise and fast-paced: strictly 1 to 3 sentences (maximum 40 words). Never write long monologues.
6. Return ONLY a valid JSON object matching this schema:
{
  "speaker": "Name of AI Participant",
  "dialogue": "Exact dialogue to be spoken out loud."
}`;

  const userPrompt = `Here is the current transcript of the group discussion so far:\n\n${transcriptHistory}\n\nDecide who speaks next and output strictly the JSON object.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('Groq API call failed, falling back to simulation:', errText);
      return simulateNextTurn(topic, participants, transcript, lastSpeakerName);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = cleanAndParseJson<NextSpeakerResponse>(content);

    if (parsed && parsed.speaker && parsed.dialogue) {
      // Validate that speaker is actually one of the AI participants
      const matched = participants.find(
        p => p.name.toLowerCase() === parsed.speaker.toLowerCase()
      );
      return {
        speaker: matched ? matched.name : participants[0].name,
        dialogue: parsed.dialogue.replace(/^"|"$/g, '').trim(),
      };
    }

    return simulateNextTurn(topic, participants, transcript, lastSpeakerName);
  } catch (error) {
    console.error('Error fetching next speaker from Groq:', error);
    return simulateNextTurn(topic, participants, transcript, lastSpeakerName);
  }
}

/**
 * Generates comprehensive post-GD evaluation report with quotes and ratings.
 */
export async function generateFeedbackReport(
  topic: string,
  userName: string,
  transcript: Message[],
  durationMinutes: number
): Promise<FeedbackReportData> {
  const apiKey = getStoredApiKey();

  const userMessages = transcript.filter(m => m.isUser || m.speaker.includes('Candidate') || m.speaker.includes(userName));
  
  if (!apiKey || userMessages.length === 0) {
    return generateFallbackReport(topic, userName, transcript, durationMinutes);
  }

  const transcriptText = transcript
    .map(m => `[${m.timestamp}] ${m.speaker}: "${m.text}"`)
    .join('\n');

  const systemPrompt = `You are a Senior Corporate Recruiter and Executive Communications Coach assessing a candidate in an intensive Group Discussion (GD).
Topic: "${topic}"
Candidate Name: "${userName}"

CRITICAL MANDATORY REQUIREMENT:
You MUST quote specific exact phrases spoken by the candidate ("${userName}") from the transcript to justify your ratings for each metric.

Evaluate the candidate on three pillars:
1. Idea Quality (Depth of reasoning, structure, novelty, clarity of problem statement)
2. Listening Skills (Acknowledging previous speakers, synthesizing points, collaborative building)
3. Handling Interruptions & Floor Control (Assertiveness without aggression, composure, pacing)

Return ONLY a valid JSON object matching this schema:
{
  "candidateName": "${userName}",
  "topic": "${topic}",
  "durationMinutes": ${durationMinutes},
  "overallScore": 8.4,
  "verdict": "Strong Hire / Recommended for Final Round",
  "executiveSummary": "Concise 2-3 sentence overview of the candidate's performance.",
  "metrics": {
    "ideaQuality": {
      "score": 8.5,
      "verdict": "Excellent",
      "analysis": "Detailed analysis of argument depth.",
      "quotes": [
        {
          "quote": "Exact words spoken by candidate from transcript",
          "context": "Why they said this",
          "comment": "Why this was strong or where it lacked evidence"
        }
      ]
    },
    "listeningSkills": {
      "score": 7.8,
      "verdict": "Good",
      "analysis": "Detailed analysis of how well they listened and built upon others.",
      "quotes": [
        {
          "quote": "Exact words showing acknowledgment or lack thereof",
          "context": "Context in conversation",
          "comment": "Evaluative feedback"
        }
      ]
    },
    "handlingInterruptions": {
      "score": 8.0,
      "verdict": "Good",
      "analysis": "Detailed analysis of assertiveness and composure.",
      "quotes": [
        {
          "quote": "Exact words or timing where floor was contested",
          "context": "Interaction with challenger",
          "comment": "Evaluative feedback"
        }
      ]
    }
  },
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "areasForImprovement": ["Area 1", "Area 2", "Area 3"],
  "actionableTips": ["Actionable tip 1", "Actionable tip 2", "Actionable tip 3"]
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the full verbatim transcript of the session:\n\n${transcriptText}\n\nProduce the comprehensive feedback evaluation JSON.` },
        ],
        temperature: 0.5,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.warn('Groq feedback API failed, using fallback analyzer.');
      return generateFallbackReport(topic, userName, transcript, durationMinutes);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = cleanAndParseJson<FeedbackReportData>(content);

    if (parsed && parsed.overallScore && parsed.metrics) {
      // Calculate participant speaking stats
      parsed.participantStats = calculateParticipantStats(transcript);
      return parsed;
    }

    return generateFallbackReport(topic, userName, transcript, durationMinutes);
  } catch (err) {
    console.error('Error generating feedback report:', err);
    return generateFallbackReport(topic, userName, transcript, durationMinutes);
  }
}

/**
 * Calculates speaking turns and word counts per participant
 */
export function calculateParticipantStats(transcript: Message[]) {
  const statsMap = new Map<string, { turns: number; wordCount: number }>();

  transcript.forEach(m => {
    const words = m.text.trim().split(/\s+/).filter(Boolean).length;
    const current = statsMap.get(m.speaker) || { turns: 0, wordCount: 0 };
    statsMap.set(m.speaker, {
      turns: current.turns + 1,
      wordCount: current.wordCount + words,
    });
  });

  return Array.from(statsMap.entries()).map(([name, data]) => ({
    name,
    turns: data.turns,
    wordCount: data.wordCount,
  }));
}

/**
 * Robust JSON parser that strips markdown code blocks if present
 */
function cleanAndParseJson<T>(raw: string): T | null {
  try {
    let clean = raw.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
    }
    return JSON.parse(clean) as T;
  } catch (e) {
    console.error('Failed to parse JSON:', e, raw);
    return null;
  }
}

/**
 * Realistic dynamic simulator for demoing and offline hackathon presentation
 */
function simulateNextTurn(
  _topic: string,
  participants: Participant[],
  transcript: Message[],
  lastSpeakerName?: string
): NextSpeakerResponse {
  // Filter eligible participants (avoiding repeating the immediate last speaker)
  const eligible = participants.filter(p => p.name !== lastSpeakerName);
  const selected = eligible.length > 0
    ? eligible[Math.floor(Math.random() * eligible.length)]
    : participants[0];

  const lastUserMsg = [...transcript].reverse().find(m => m.isUser);
  const snippet = lastUserMsg ? lastUserMsg.text.slice(0, 40) + '...' : 'the core problem';

  const responsesByPersona: Record<string, string[]> = {
    moderator: [
      `That is an interesting angle on ${snippet}. Let's make sure we examine both short-term impact and long-term sustainability. Does anyone have data to support this?`,
      `I appreciate that perspective. Let's synthesize this with our earlier points so we can build toward a clear recommendation before time runs out.`,
      `Well put. Let's also bring in other perspectives—how does this impact the broader ecosystem and not just individual stakeholders?`,
    ],
    data_nerd: [
      `Looking at the empirical numbers, recent studies show a 34% variance between theoretical models and real-world adoption here. We need concrete metrics before drawing conclusions.`,
      `Let's look at the unit economics. The data indicates that early adopters saw efficiency gains, but customer churn remained flat at 12%. That challenges that premise.`,
      `I agree in principle, but the statistical evidence is mixed. Without accounting for sample bias, we risk over-generalizing from isolated case studies.`,
    ],
    dominator: [
      `I have to strongly push back on that. That assumption completely overlooks operational reality in high-pressure markets! We cannot afford to be passive here.`,
      `That sounds noble, but in practice it collapses immediately. If we don't take an aggressive, proactive stance right now, competitors will wipe out the advantage.`,
      `Let's cut through the theory—the decisive factor here is speed and execution. Sitting on the fence will guarantee failure.`,
    ],
    quiet_one: [
      `If I may add a quieter observation... beyond the immediate economic calculations, we shouldn't forget the human dignity and ethical dimension of this choice.`,
      `I notice we have been focusing primarily on the loudest symptoms, but perhaps the root cause lies in how incentives were aligned in the first place.`,
      `Perhaps the real solution is not choosing between either extreme, but finding an adaptive middle ground where both principles coexist.`,
    ],
    devils_advocate: [
      `Everyone seems to agree, which makes me skeptical. What happens when the secondary unintended consequences kick in and reverse our progress?`,
      `Consider the reverse hypothesis: what if what we perceive as a threat is actually the exact catalyst needed for necessary disruption?`,
      `Playing devil's advocate for a moment—if this solution is so obvious, why hasn't any leading organization successfully sustained it yet?`,
    ],
  };

  const pool = responsesByPersona[selected.id] || responsesByPersona['moderator'];
  const dialogue = pool[Math.floor(Math.random() * pool.length)];

  return {
    speaker: selected.name,
    dialogue,
  };
}

/**
 * Rich offline report generator that inspects actual user messages from the transcript
 */
function generateFallbackReport(
  topic: string,
  userName: string,
  transcript: Message[],
  durationMinutes: number
): FeedbackReportData {
  const userMessages = transcript.filter(m => m.isUser || m.speaker.includes('Candidate') || m.speaker.includes(userName));
  const userTurns = userMessages.length;
  const userWords = userMessages.reduce((acc, m) => acc + m.text.split(/\s+/).length, 0);

  const primaryQuote = userMessages[0]?.text || "Let us look at both sides of the argument before reaching a consensus.";
  const secondQuote = userMessages[1]?.text || "I agree with the point made earlier, but we must also consider implementation costs.";
  const thirdQuote = userMessages[2]?.text || userMessages[userMessages.length - 1]?.text || "To summarize, our strategy should balance innovation with safety.";

  const baseScore = userTurns >= 3 ? 8.2 : userTurns >= 1 ? 7.1 : 5.8;

  return {
    candidateName: userName,
    topic,
    durationMinutes,
    overallScore: baseScore,
    verdict: baseScore >= 8.0 ? 'Strong Candidate / Clear Leadership Potential' : 'Promising / Needs More Proactive Interventions',
    executiveSummary: `The candidate showed good clarity in their ${userTurns} speaking turns (${userWords} words total). They articulated logical viewpoints, responded respectfully to challenges from peers, and maintained steady vocal composure throughout the group discussion.`,
    metrics: {
      ideaQuality: {
        score: Math.min(9.2, baseScore + 0.3),
        verdict: 'Good',
        analysis: 'Demonstrated solid conceptual clarity and structured thinking. Formulated reasonable arguments rather than emotional assertions.',
        quotes: [
          {
            quote: primaryQuote,
            context: 'Early discussion framing',
            comment: 'Established a logical baseline and set a constructive tone for the rest of the group.',
          },
        ],
      },
      listeningSkills: {
        score: Math.min(8.8, baseScore - 0.2),
        verdict: 'Good',
        analysis: 'Successfully referenced points raised by other participants instead of delivering disconnected monologues.',
        quotes: [
          {
            quote: secondQuote,
            context: 'Responding to peer intervention',
            comment: 'Acknowledged prior input before introducing a complementary constraint.',
          },
        ],
      },
      handlingInterruptions: {
        score: Math.min(8.6, baseScore + 0.1),
        verdict: 'Good',
        analysis: 'Maintained composure when other strong personalities entered the floor. Stood ground with professional assertiveness.',
        quotes: [
          {
            quote: thirdQuote,
            context: 'Navigating debate tension',
            comment: 'Politely reclaimed floor presence and helped redirect energy toward shared resolution.',
          },
        ],
      },
    },
    keyStrengths: [
      'Structured logical reasoning with clear beginning and conclusions',
      'Non-defensive demeanor when challenged by contrarian peers',
      'Good articulation and vocal clarity under time constraints',
    ],
    areasForImprovement: [
      'Incorporate more quantitative metrics and empirical data points',
      'Initiate earlier in the session to anchor the agenda and pace',
      'Directly invite quieter participants to demonstrate team leadership',
    ],
    actionableTips: [
      'Frame your opening remark with a 3-point framework (e.g., Short-term, Medium-term, Ethical implications).',
      'When interrupted, use bridging phrases like: "Building on that thought, let me complete this critical aspect..."',
      'Conclude each turn with an open question to maintain positive group momentum.',
    ],
    participantStats: calculateParticipantStats(transcript),
  };
}
