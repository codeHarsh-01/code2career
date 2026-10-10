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
  lastSpeakerName?: string,
  targetSpeaker?: Participant,
  language: 'English' | 'Hindi' = 'English'
): Promise<NextSpeakerResponse> {
  const apiKey = getStoredApiKey();

  // If no API key is provided, use the high-quality local simulated GD engine
  if (!apiKey) {
    return simulateNextTurn(topic, participants, transcript, lastSpeakerName, targetSpeaker, language);
  }

  const personaName = targetSpeaker ? targetSpeaker.name : participants[0].name;
  const personaRole = targetSpeaker ? targetSpeaker.role : 'Discussant';
  const personaInstruction = targetSpeaker ? targetSpeaker.promptInstruction : '';

  const transcriptHistory = transcript.length === 0
    ? '(No conversation yet. Open the discussion with an insightful point or framing on the topic.)'
    : transcript
        .map((m, idx) => `[Turn ${idx + 1}] ${m.speaker}: "${m.text}"`)
        .join('\n');

  // 1. Stronger System Prompt (Context Anchoring, Language & Strict Rules)
  const systemPrompt = `You are participating in a Group Discussion. The strict topic is: "${topic}". You must stay absolutely focused on this topic.

You are playing the role of: ${personaName} (${personaRole}). Act according to this persona.
Persona Guidelines: ${personaInstruction}

CRITICAL RULE 1: The user has chosen to conduct this group discussion in ${language}. You MUST generate your entire response ONLY in ${language}. If Hindi is selected, use Devanagari script.

CRITICAL RULE 2: Speak naturally. DO NOT repeat the full topic name in your responses. Refer to the topic naturally using pronouns (e.g., 'this issue').

CRITICAL RULE 3: If the User's input is gibberish, grammatically broken, or looks like a speech-to-text error, DO NOT repeat their nonsense words. Instead, have the AI politely ask for clarification (e.g., 'I didn't quite catch that, could you repeat your point?').

ANTI-REPETITION REQUIREMENT:
- Read the transcript provided. DO NOT repeat what has already been said.
- Do not just agree with the previous speaker. You must introduce a NEW argument, disagree constructively, or bring a new data point to push the conversation forward.
- Speak concisely in 2-3 sentences max (under 45 words).

OUTPUT REQUIREMENT:
Return ONLY a valid, parseable JSON object matching this schema:
{
  "speaker": "${personaName}",
  "dialogue": "Exact dialogue to be spoken out loud."
}`;

  const userPrompt = `Strict GD Topic: "${topic}"
Discussion Language: ${language}

Full Transcript of the Group Discussion so far:
${transcriptHistory}

Instructions for ${personaName}:
1. Address the latest points in the transcript directly in ${language}.
2. Speak naturally and refer to the topic using pronouns rather than repeating the full topic name.
3. Advance the discussion with a distinct, fresh perspective or constructive challenge in 2-3 sentences max.
4. If the last user statement is gibberish or an STT error, politely ask for clarification in ${language}.
5. Output strictly the JSON object.`;

  try {
    // 2. Tweak API Parameters: temperature 0.8, frequency_penalty 0.5, presence_penalty 0.5
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
        temperature: 0.8,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('Groq API call failed, falling back to simulation:', errText);
      return simulateNextTurn(topic, participants, transcript, lastSpeakerName, targetSpeaker, language);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = cleanAndParseJson<NextSpeakerResponse>(content);

    if (parsed && parsed.speaker && parsed.dialogue) {
      const matched = participants.find(
        p => p.name.toLowerCase() === parsed.speaker.toLowerCase()
      );
      return {
        speaker: matched ? matched.name : personaName,
        dialogue: parsed.dialogue.replace(/^"|"$/g, '').trim(),
      };
    }

    return simulateNextTurn(topic, participants, transcript, lastSpeakerName, targetSpeaker, language);
  } catch (error) {
    console.error('Error fetching next speaker from Groq:', error);
    return simulateNextTurn(topic, participants, transcript, lastSpeakerName, targetSpeaker, language);
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
  lastSpeakerName?: string,
  targetSpeaker?: Participant,
  language: 'English' | 'Hindi' = 'English'
): NextSpeakerResponse {
  let selected = targetSpeaker;
  if (!selected) {
    const eligible = participants.filter(p => p.name !== lastSpeakerName);
    selected = eligible.length > 0
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : participants[0];
  }

  const lastMsg = transcript.length > 0 ? transcript[transcript.length - 1] : null;

  // CRITICAL RULE 3: Check if last user speech looks like broken STT / gibberish (< 4 chars or mostly noise)
  if (lastMsg && lastMsg.isUser) {
    const cleanUserText = lastMsg.text.trim();
    const isGibberish = cleanUserText.length < 4 || /^[^a-zA-Z0-9\u0900-\u097F]+$/.test(cleanUserText);
    if (isGibberish) {
      return {
        speaker: selected.name,
        dialogue: language === 'Hindi'
          ? 'माफ़ कीजिए, मैं आपकी बात ठीक से समझ नहीं पाया। क्या आप अपना विचार दोबारा संक्षेप में रख सकते हैं?'
          : "I didn't quite catch that, could you repeat your point?",
      };
    }
  }

  // English Persona Dialogue (Natural pronouns, no full topic repetition)
  const englishResponses: Record<string, string[]> = {
    moderator: [
      `Regarding this issue, let's synthesize the points raised so far so we can build toward an actionable consensus.`,
      `That touches a vital angle on this subject. Let's ensure both immediate trade-offs and structural governance are evaluated.`,
      `Well noted. Before we conclude, who can offer an operational perspective that hasn't been brought up yet?`,
      `Let's keep our focus sharp. Building upon that thought, how do we practically execute this recommendation?`,
    ],
    data_nerd: [
      `Looking at the empirical benchmarks on this matter, studies show a 34% variance between projection and actual adoption. We need concrete metrics.`,
      `Let's look at the unit economics here. The data indicates that early adopters saw efficiency gains, but customer churn remained flat at 12%.`,
      `I agree with the direction, but the statistical evidence is nuanced. Without accounting for sample bias, we risk false correlation.`,
      `Analyzing industry KPIs, implementation costs in this sector typically scale 2.5 times higher than initial pilot forecasts.`,
    ],
    dominator: [
      `I have to strongly push back on that! In real-world market deployment, passive strategies get crushed by faster competitors!`,
      `That sounds cautious, but it guarantees failure. If we don't take a decisive, first-mover position on this, competitors will own the space.`,
      `Let's cut through theoretical hesitation. Speed of execution is the only metric that separates winners from losers here.`,
      `We cannot afford incrementalism. Bold disruption is the only defensible strategy in this environment!`,
    ],
    quiet_one: [
      `If I may offer an overlooked nuance... beyond the immediate financial metrics, what are the cultural and human ramifications?`,
      `I notice we are addressing the symptoms of this challenge, but perhaps the root cause lies in misaligned structural incentives.`,
      `Perhaps our approach shouldn't be binary. The most resilient solutions bridge these competing paradigms rather than choosing one.`,
      `Let's not forget the long-term ethical implications of our decisions here. Public trust is much harder to rebuild than speed.`,
    ],
    devils_advocate: [
      `Everyone seems to accept that premise, which makes me skeptical. What happens when the secondary unintended consequences kick in?`,
      `Consider the reverse hypothesis: what if what we perceive as a threat is actually the exact catalyst needed for innovation?`,
      `Playing devil's advocate—if this strategy is so straightforward, why have previous industry pioneers failed to sustain it?`,
      `What if the fundamental assumption guiding our consensus is outdated in the current macroeconomic reality?`,
    ],
    strategist: [
      `Connecting this to our macro roadmap, we must look at 3-year platform defensibility rather than quick tactical patches.`,
      `From an organizational scale perspective, alignment between regulatory compliance and resource allocation is where initiatives succeed or fail.`,
      `To ensure defensibility, we need phased milestones. Phase one must de-risk adoption before capital expenditure scales.`,
      `The competitive moat won't come from technology alone, but from ecosystem integration and network effects.`,
    ],
  };

  // Hindi Persona Dialogue (Natural pronouns, Devanagari script)
  const hindiResponses: Record<string, string[]> = {
    moderator: [
      `इस मुद्दे पर, आइए हम अब तक रखे गए विचारों को संक्षेप में जोड़ें ताकि हम एक ठोस और व्यावहारिक निष्कर्ष पर पहुँच सकें।`,
      `यह एक बहुत महत्वपूर्ण दृष्टिकोण है। हमें इसके तात्कालिक प्रभाव और दीर्घकालिक स्थिरता दोनों पर विचार करना चाहिए।`,
      `आपकी बात सही है। पर क्या किसी के पास इस दृष्टिकोण का समर्थन करने के लिए वास्तविक डेटा या व्यावहारिक अनुभव है?`,
      `आइए चर्चा को केंद्रित रखें। इस विचार को आगे बढ़ाते हुए, हम इसे ज़मीनी स्तर पर कैसे लागू कर सकते हैं?`,
    ],
    data_nerd: [
      `यदि हम इस मामले के वास्तविक आंकड़ों को देखें, तो हाल के अध्ययनों से पता चलता है कि अनुमान और वास्तविक क्रियान्वयन में 35% का अंतर है।`,
      `यूनिट इकोनॉमिक्स के दृष्टिकोण से, शुरुआती लागत अनुमान से लगभग दोगुनी हो जाती है। बिना ठोस वित्तीय योजना के यह व्यवहार्य नहीं है।`,
      `मैं इस दिशा से सहमत हूँ, लेकिन सांख्यिकीय साक्ष्य बताते हैं कि व्यापक स्तर पर अभी भी कई अनिश्चितताएँ हैं।`,
      `उद्योग के आंकड़ों के अनुसार, समय पर सही डेटा विश्लेषण न होने से 40% संसाधन व्यर्थ हो जाते हैं।`,
    ],
    dominator: [
      `मैं इस बात से पूरी तरह असहमत हूँ! इस प्रतिस्पर्धी माहौल में सुस्त और संकोची रणनीतियाँ तुरंत विफल हो जाती हैं। हमें आक्रामक रुख अपनाना होगा!`,
      `सिद्धांतों में उलझने के बजाय, हमें तेज निर्णय और निष्पादन पर ध्यान देना चाहिए। झिझक केवल असफलता की गारंटी देगी।`,
      `सतर्क रहना अच्छी बात है, लेकिन यहाँ केवल गति और साहसिक कदम ही हमें आगे रख सकते हैं!`,
      `हम आधी-अधूरी कोशिशें नहीं कर सकते। यदि हमें सफल होना है, तो पूरे आत्मविश्वास के साथ आगे बढ़ना होगा!`,
    ],
    quiet_one: [
      `यदि मैं एक शांत पहलू जोड़ सकूँ... तो केवल वित्तीय लाभ के बजाय, हमें मानवीय और नैतिक प्रभावों को भी नहीं भूलना चाहिए।`,
      `मुझे लगता है कि हम केवल बाहरी लक्षणों पर ध्यान दे रहे हैं, जबकि मूल समस्या हमारी प्राथमिकताओं में है।`,
      `शायद हमें किसी एक छोर को चुनने के बजाय एक संतुलित और टिकाऊ मध्य मार्ग तलाशना चाहिए।`,
      `विश्वास और सामाजिक प्रभाव को दरकिनार करके कोई भी योजना लंबे समय तक सफल नहीं हो सकती।`,
    ],
    devils_advocate: [
      `सभी इस प्रस्ताव से सहमत दिख रहे हैं, जो मुझे संदेहास्पद लगता है। क्या हमने इसके अनपेक्षित दुष्प्रभावों पर विचार किया है?`,
      `इसके विपरीत सोचें: क्या होगा यदि जिसे हम एक बड़ा जोखिम मान रहे हैं, वह वास्तव में नवाचार का सबसे बड़ा अवसर हो?`,
      `यदि यह समाधान इतना सरल और स्पष्ट है, तो अब तक कोई बड़ा संगठन इसे पूरी तरह लागू क्यों नहीं कर पाया?`,
      `क्या हम पुरानी मान्यताओं के आधार पर भविष्य का फैसला तो नहीं कर रहे हैं?`,
    ],
    strategist: [
      `दीर्घकालिक दृष्टिकोण से, हमें इस मुद्दे के 3-वर्षीय रोडमैप और नीतिगत ढांचे पर ध्यान केंद्रित करना चाहिए, न कि केवल त्वरित समाधानों पर।`,
      `किसी भी बड़े बदलाव के लिए चरणबद्ध योजना आवश्यक है। पहले चरण में जोखिम कम करना होगा, फिर विस्तार करना होगा।`,
      `हमारा वास्तविक लाभ केवल तकनीक से नहीं, बल्कि एक मजबूत और एकीकृत प्रणाली बनाने से आएगा।`,
      `रणनीतिक सफलता के लिए संसाधनों का सही आवंटन और नियमों का पालन अनिवार्य है।`,
    ],
  };

  const responsesByPersona = language === 'Hindi' ? hindiResponses : englishResponses;
  const pool = responsesByPersona[selected.id] || responsesByPersona['moderator'];

  // Anti-repetition: filter out any responses already present in transcript
  const alreadySpoken = new Set(transcript.map(m => m.text.trim().toLowerCase()));
  const unsaid = pool.filter(d => !alreadySpoken.has(d.trim().toLowerCase()));
  const candidates = unsaid.length > 0 ? unsaid : pool;
  const dialogue = candidates[Math.floor(Math.random() * candidates.length)];

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
