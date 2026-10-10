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

  const currentTopic = topic?.trim() || 'General Group Discussion';

  // 1. Stronger System Prompt (Context Anchoring, Language & Strict Rules)
  const systemPrompt = `You are participating in a Group Discussion.
The current Group Discussion topic is exactly: "${currentTopic}". You MUST strictly align your vocabulary, arguments, and examples with this specific topic. Do not use generic corporate business jargon unless the topic is explicitly about business/finance. If the topic is general (like Mobile Phones), use relatable, everyday examples.

You are playing the role of: ${personaName} (${personaRole}). Act according to this persona.
Persona Guidelines: ${personaInstruction}

Adapt your persona to the topic. If you are "The Data Nerd" and the topic is Mobile Phones, quote data about screen time, mental health, or global sales, NOT corporate financial KPIs.

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

  const userPrompt = `The current Group Discussion topic is exactly: "${currentTopic}". You MUST strictly align your vocabulary, arguments, and examples with this specific topic. Do not use generic corporate business jargon unless the topic is explicitly about business/finance. If the topic is general (like Mobile Phones), use relatable, everyday examples.
Adapt your persona to the topic. If you are "The Data Nerd" and the topic is Mobile Phones, quote data about screen time, mental health, or global sales, NOT corporate financial KPIs.
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
  topic: string,
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

  const isMobileTopic = /mobile|phone|smartphone|screen|device|cellphone/i.test(topic);
  const isBusinessTopic = /corporate|finance|roi|revenue|profit|business model|enterprise|investment/i.test(topic);

  // English Dialogue Pools
  const englishMobileResponses: Record<string, string[]> = {
    moderator: [
      `Regarding this issue, let's balance the immense convenience of instant connectivity with the mental health and screen addiction concerns.`,
      `That touches a vital point on this subject. On one hand, we have instant communication and digital tools; on the other, attention fragmentation.`,
      `Well noted. Before we conclude, who can offer practical habits for healthy phone boundaries that haven't been mentioned yet?`,
      `Let's keep our focus balanced: acknowledging the transformative power of mobile technology while addressing real-world distractions.`,
    ],
    data_nerd: [
      `Studies show the average person spends over 4.5 hours daily on their phone and checks notifications upwards of 70 times a day.`,
      `Research from sleep institutes demonstrates that late-night blue light exposure reduces melatonin production by nearly 22%, disrupting deep rest.`,
      `On the positive side, global smartphone penetration exceeding 68% has connected over 2 billion people to basic banking, healthcare, and education.`,
      `Cognitive studies reveal that having a smartphone sitting visible on your desk reduces working memory performance by up to 10%, even when silent.`,
    ],
    dominator: [
      `Let's be realistic! Blaming the smartphone is an excuse for poor personal self-control. Used intentionally, it's the greatest learning tool ever made!`,
      `I have to push back! Without mobile technology, emergency response, daily navigation, and modern communication would literally freeze!`,
      `The issue isn't the device itself, but mindless scrolling habits. Proactive individuals use phones to build careers, not waste time!`,
      `Treating mobile phones as mostly negative completely ignores how they democratized instant knowledge for billions of people!`,
    ],
    quiet_one: [
      `If I may share a quiet observation... when we are constantly reachable through a screen, we gradually lose the gift of undistracted presence with those around us.`,
      `I notice we often talk about speed and convenience, but the deeper casualty is our capacity for quiet reflection and deep attention.`,
      `Perhaps the real dilemma isn't whether phones are good or bad, but whether we control the device or allow notifications to dictate our thoughts.`,
      `Beyond convenience, we need to consider how early smartphone exposure impacts children's emotional regulation and interpersonal empathy.`,
    ],
    devils_advocate: [
      `Everyone assumes instant connectivity brings us closer, but what if constant messaging actually makes our relationships more superficial?`,
      `Consider this counterpoint: we believe smartphones save us time, yet surveys prove they consume more leisure hours than any tool in history.`,
      `If having constant information in our pocket makes us smarter, why are global attention spans and reading comprehension metrics dropping?`,
      `What if the convenience of outsourcing our memory and directions to an algorithm is weakening our fundamental cognitive autonomy?`,
    ],
    strategist: [
      `Looking at practical solutions, the answer isn't ditching smartphones, but designing healthy friction—like screen-free study hours and notification curfews.`,
      `From a societal perspective, integrating digital wellness and intentional tech habits into school education is our most scalable safeguard.`,
      `A balanced approach requires personal guidelines: turning off non-urgent alerts, keeping bedrooms device-free, and prioritizing offline interactions.`,
      `To maximize the benefits while curbing the drawbacks, we need proactive individual discipline combined with thoughtful digital literacy.`,
    ],
  };

  const englishGeneralResponses: Record<string, string[]> = {
    moderator: [
      `Regarding this issue, let's synthesize the diverse perspectives raised so far to build toward a balanced, constructive view.`,
      `That highlights a crucial everyday angle. Let's make sure we examine both individual responsibilities and broader societal impact.`,
      `Well noted. Who can contribute an everyday observation or practical example that hasn't been brought to light yet?`,
      `Let's keep our discussion grounded and constructive. Building on that thought, what is the most realistic next step?`,
    ],
    data_nerd: [
      `Examining empirical survey benchmarks on this matter, over 62% of respondents report feeling the daily impact directly in their routines.`,
      `Cross-sectional studies highlight that gradual habit shifts yield over 3 times higher adherence than abrupt behavioral bans.`,
      `The qualitative evidence is clear, but statistical surveys show a notable divide between urban and rural demographics here.`,
      `According to public data sets, regular self-monitoring improves positive outcomes on this subject by nearly 28%.`,
    ],
    dominator: [
      `I have to firmly push back! We cannot keep over-analyzing simple realities—decisive action and personal ownership are what matter!`,
      `That sounds overly cautious. If we don't take an active, confident stance on this, we'll remain stuck debating hypotheticals!`,
      `Let's cut through theoretical hesitation. Practical experience consistently beats passive over-thinking!`,
      `We must be bold here. Incremental half-measures won't solve the core challenges we're facing!`,
    ],
    quiet_one: [
      `If I may offer an overlooked nuance... beyond the immediate surface arguments, what are the subtle human and emotional dimensions?`,
      `I notice we are addressing the visible symptoms of this issue, but the root cause often lies in our day-to-day priorities.`,
      `Perhaps our approach shouldn't be binary. The most resilient solutions find harmony between two competing viewpoints.`,
      `Let's remember that long-term trust, genuine well-being, and mutual empathy matter far more than quick wins.`,
    ],
    devils_advocate: [
      `Everyone seems to share that premise, which makes me question it. What unintended side effects are we collectively ignoring?`,
      `Consider the reverse angle: what if what we perceive as a disadvantage is actually the catalyst needed for positive change?`,
      `Playing devil's advocate—if that solution is so obvious, why hasn't it become the common standard in daily practice?`,
      `What if the conventional assumption guiding our consensus is fundamentally mismatched with modern daily realities?`,
    ],
    strategist: [
      `Looking at the big picture, we must focus on sustainable long-term habits rather than temporary quick fixes.`,
      `From an implementation standpoint, consistency and realistic daily milestones determine whether solutions actually stick.`,
      `To ensure lasting success, we need a phased approach: build awareness first, then establish clear guidelines.`,
      `The most dependable way forward combines personal self-regulation with community awareness and supportive environments.`,
    ],
  };

  const englishBusinessResponses: Record<string, string[]> = {
    moderator: [
      `Regarding this issue, let's evaluate both immediate financial trade-offs and structural governance before reaching a verdict.`,
      `That touches a vital economic angle. Let's ensure both cost efficiency and long-term sustainability are accounted for.`,
      `Well noted. Who can offer an operational or market perspective that hasn't been brought up yet?`,
      `Let's keep our focus sharp on execution feasibility and resource allocation.`,
    ],
    data_nerd: [
      `Looking at the empirical benchmarks on this matter, studies show a 34% variance between projection and actual adoption.`,
      `Analyzing unit economics and financial feasibility, initial capital outlays in this sector typically require disciplined staging.`,
      `The statistical evidence is nuanced. Without accounting for market variance, we risk false correlation in our forecasts.`,
      `Benchmarking comparative studies, efficiency gains materialize only when operational workflows are restructured.`,
    ],
    dominator: [
      `I have to strongly push back! In competitive deployment, passive strategies get crushed by faster movers!`,
      `Speed of execution is the definitive metric that separates successful initiatives from stalled ones!`,
      `Let's cut through theoretical hesitation—bold execution is the only defensible strategy here!`,
      `We cannot afford incrementalism when market dynamics demand immediate, decisive leadership!`,
    ],
    quiet_one: [
      `If I may offer a nuance... beyond financial returns, what are the organizational and ethical ramifications?`,
      `Perhaps the root issue lies in misaligned incentives rather than surface execution hurdles.`,
      `The most resilient organizations bridge competing priorities rather than choosing one extreme.`,
      `Public trust and institutional integrity are far harder to rebuild once compromised.`,
    ],
    devils_advocate: [
      `Everyone accepts that premise, which makes me skeptical. What happens when unintended economic headwinds hit?`,
      `Playing devil's advocate—if this strategy is so bulletproof, why have previous industry leaders struggled with it?`,
      `What if our core operating assumption is outdated in the current macroeconomic reality?`,
      `Consider the downside risk: are we over-indexing on short-term upside while ignoring structural liabilities?`,
    ],
    strategist: [
      `Connecting this to our roadmap, we must look at 3-year platform defensibility rather than quick tactical patches.`,
      `Alignment between regulatory compliance and resource allocation is where initiatives succeed or fail.`,
      `To ensure defensibility, phased milestones must de-risk adoption before capital expenditure scales.`,
      `Sustainable competitive advantages stem from ecosystem integration and network effects.`,
    ],
  };

  // Hindi Dialogue Pools
  const hindiMobileResponses: Record<string, string[]> = {
    moderator: [
      `इस मुद्दे पर, आइए हम मोबाइल फोन की अपार सुविधाओं और इसके दुष्प्रभावों—जैसे स्क्रीन की लत और मानसिक तनाव—के बीच एक संतुलित चर्चा करें।`,
      `यह बहुत महत्वपूर्ण दृष्टिकोण है। एक तरफ जहाँ मोबाइल ने आपातकालीन सहायता, शिक्षा और संवाद को सुगम बनाया है, वहीं दूसरी तरफ सामाजिक दूरी भी बढ़ाई है।`,
      `आपकी बात सही है। पर क्या किसी के पास दैनिक जीवन में मोबाइल के संतुलित उपयोग के लिए कोई व्यावहारिक उपाय है?`,
      `आइए चर्चा को केंद्रित रखें। तकनीक की उपयोगिता को बनाए रखते हुए हम इसकी लत से खुद को कैसे बचा सकते हैं?`,
    ],
    data_nerd: [
      `यदि हम आंकड़ों को देखें, तो हाल के सर्वेक्षण बताते हैं कि एक औसत व्यक्ति दिन में लगभग 4 से 5 घंटे अपने फोन पर बिताता है और 70 से अधिक बार स्क्रीन चेक करता है।`,
      `स्वास्थ्य अध्ययनों के अनुसार, सोने से पहले स्क्रीन के अधिक उपयोग से मेलाटोनिन का स्तर 22% तक घट जाता है, जिससे नींद की गुणवत्ता सीधे प्रभावित होती है।`,
      `सकारात्मक पक्ष देखें तो, मोबाइल कनेक्टिविटी के कारण आज दुनिया भर में 2 अरब से अधिक लोग डिजिटल शिक्षा, बैंकिंग और स्वास्थ्य सेवाओं से सीधे जुड़ चुके हैं।`,
      `मनोवैज्ञानिक अध्ययनों से पता चलता है कि पढ़ाई या जरूरी काम के दौरान फोन पास रखने से एकाग्रता में 10% से 15% की कमी आ जाती है।`,
    ],
    dominator: [
      `मैं इस बात से पूरी तरह असहमत हूँ! मोबाइल फोन को दोष देना केवल अपनी आत्म-अनुशासन की कमी को छुपाना है। सही इस्तेमाल करने पर यह ज्ञान का सबसे बड़ा स्रोत है!`,
      `हमें वास्तविकता समझनी चाहिए—आज बिना मोबाइल के आपातकालीन मदद, ऑनलाइन पढ़ाई या त्वरित संपर्क संभव ही नहीं है। इसे नकारना समझदारी नहीं है!`,
      `समस्या फोन में नहीं, बल्कि बिना सोचे-समझे रील और सोशल मीडिया स्क्रॉल करने की आदत में है। जो इसका सदुपयोग करते हैं, वे निरंतर आगे बढ़ रहे हैं!`,
      `सिर्फ कमियों पर बात करने के बजाय हमें यह देखना चाहिए कि इसने आम नागरिकों और छात्रों को कितनी बड़ी सुविधा और आत्मनिर्भरता दी है!`,
    ],
    quiet_one: [
      `यदि मैं एक शांत पहलू जोड़ सकूँ... निरंतर स्क्रीन से जुड़े रहने के कारण हम अपनों के साथ आमने-सामने के गहरे संवाद और शांति को खोते जा रहे हैं।`,
      `मुझे लगता है कि सुविधा के चक्कर में हमारी एकाग्रता और धैर्य का सबसे बड़ा नुकसान हुआ है। तुरंत संतुष्टि की चाहत ने हमें अशांत बना दिया है।`,
      `शायद असली सवाल यह है कि क्या हम फोन को नियंत्रित कर रहे हैं, या फोन के नोटिफिकेशन हमारे समय और मन को नियंत्रित कर रहे हैं।`
    ],
    devils_advocate: [
      `सभी मानते हैं कि फोन ने संपर्क आसान किया है, पर क्या इससे हमारे रिश्ते सच में गहरे हुए हैं या केवल दिखावटी और सतही बनकर रह गए हैं?`,
      `क्या हमने कभी सोचा है कि जो साधन हमारा समय बचाने के लिए बना था, वही आज हमारे 24 घंटों में से सबसे ज्यादा समय चुरा रहा है?`,
      `यदि इंटरनेट और फोन ने हमें अधिक जानकार बनाया है, तो फिर लोगों की सोचने की गहराई और याददाश्त पहले से कमजोर क्यों हो रही है?`,
      `क्या तकनीक हमें वास्तव में स्वतंत्र बना रही है, या हम हर मिनट फोन की स्क्रीन देखने के आदी हो चुके हैं?`,
    ],
    strategist: [
      `व्यावहारिक समाधान यह है कि हम फोन छोड़ने के बजाय डिजिटल अनुशासन अपनाएं—जैसे भोजन और अध्ययन के समय फोन को दूर रखना।`,
      `दीर्घकालिक दृष्टि से, स्कूलों और परिवारों में डिजिटल वेलनेस और स्क्रीन-टाइम की सीमा तय करना ही सबसे प्रभावी कदम होगा।`,
      `अनावश्यक नोटिफिकेशन बंद करके और उद्देश्यपूर्ण उपयोग की आदत डालकर हम इसके लाभ ले सकते हैं और नुकसान से बच सकते हैं।`,
      `संतुलित जीवन के लिए जरूरी है कि हम तकनीक को अपना सेवक बनाएं, उसका गुलाम न बनें।`,
    ],
  };

  const hindiGeneralResponses: Record<string, string[]> = {
    moderator: [
      `इस मुद्दे पर, आइए हम अब तक रखे गए विचारों को संक्षेप में जोड़ें ताकि हम एक ठोस और व्यावहारिक निष्कर्ष पर पहुँच सकें।`,
      `यह एक बहुत महत्वपूर्ण दृष्टिकोण है। हमें इसके व्यक्तिगत प्रभाव और सामाजिक पहलुओं दोनों पर संतुलित विचार करना चाहिए।`,
      `आपकी बात सही है। पर क्या किसी के पास इस दृष्टिकोण का समर्थन करने के लिए कोई दैनिक जीवन का व्यावहारिक उदाहरण है?`,
      `आइए चर्चा को केंद्रित रखें। इस विचार को आगे बढ़ाते हुए, हम इसे रोज़मर्रा के जीवन में कैसे लागू कर सकते हैं?`,
    ],
    data_nerd: [
      `यदि हम हाल के सर्वेक्षणों को देखें, तो 60% से अधिक लोग मानते हैं कि इस विषय का उनके दैनिक जीवन और आदतों पर सीधा असर पड़ता है।`,
      `अध्ययनों से पता चलता है कि किसी भी बदलाव के लिए अचानक पाबंदी लगाने के बजाय धीरे-धीरे अच्छी आदतें बनाना 3 गुना अधिक सफल रहता है।`,
      `व्यापक आंकड़ों के अनुसार, समय पर सही जागरूकता और आत्म-नियंत्रण होने से सकारात्मक परिणामों में 30% तक सुधार होता है।`,
      `सामाजिक अध्ययनों से स्पष्ट है कि अलग-अलग आयु वर्ग के लोगों के अनुभव और ज़रूरतें इस मामले में काफी भिन्न हैं।`,
    ],
    dominator: [
      `मैं इस बात से पूरी तरह असहमत हूँ! केवल संकोच और झिझक में समय गंवाने के बजाय हमें आत्मविश्वास से स्पष्ट कदम उठाना चाहिए!`,
      `सिद्धांतों में उलझने के बजाय, हमें व्यावहारिक निर्णय और आत्म-अनुशासन पर ध्यान देना चाहिए। झिझक केवल समय बर्बाद करेगी!`,
      `सतर्क रहना अच्छी बात है, लेकिन यहाँ केवल स्पष्ट सोच और साहसिक पहल ही हमें सही दिशा में आगे रख सकती है!`,
      `हम आधी-अधूरी कोशिशें नहीं कर सकते। यदि हमें सफल होना है, तो पूरे दृढ़ संकल्प के साथ आगे बढ़ना होगा!`,
    ],
    quiet_one: [
      `यदि मैं एक शांत पहलू जोड़ सकूँ... तो केवल बाहरी लाभों के बजाय, हमें मानवीय और नैतिक मूल्यों को भी नहीं भूलना चाहिए।`,
      `मुझे लगता है कि हम केवल बाहरी लक्षणों पर ध्यान दे रहे हैं, जबकि मूल सुधार हमारी प्राथमिकताओं और सोच में होना चाहिए।`,
      `शायद हमें किसी एक छोर को चुनने के बजाय एक संतुलित और टिकाऊ मध्य मार्ग तलाशना चाहिए।`,
      `विश्वास और आपसी समझ को दरकिनार करके कोई भी बदलाव लंबे समय तक सार्थक नहीं हो सकता।`,
    ],
    devils_advocate: [
      `सभी इस प्रस्ताव से सहमत दिख रहे हैं, जो मुझे संदेहास्पद लगता है। क्या हमने इसके अनपेक्षित दुष्प्रभावों पर विचार किया है?`,
      `इसके विपरीत सोचें: क्या होगा यदि जिसे हम एक कमी मान रहे हैं, वह वास्तव में सुधार का सबसे बड़ा अवसर हो?`,
      `यदि यह समाधान इतना सरल और स्पष्ट है, तो आम लोग इसे अपनी दिनचर्या में आसानी से क्यों नहीं अपना पाते?`,
      `क्या हम पुरानी मान्यताओं के आधार पर वर्तमान का फैसला तो नहीं कर रहे हैं?`,
    ],
    strategist: [
      `व्यावहारिक दृष्टिकोण से, हमें दीर्घकालिक आदतों और टिकाऊ नियमों पर ध्यान केंद्रित करना चाहिए, न कि केवल तात्कालिक उपायों पर।`,
      `किसी भी सकारात्मक बदलाव के लिए चरणबद्ध योजना आवश्यक है: पहले जागरूकता, फिर निरंतर अभ्यास।`,
      `हमारा वास्तविक लाभ केवल नियमों से नहीं, बल्कि आत्म-अनुशासन और स्वस्थ वातावरण बनाने से आएगा।`,
      `सार्थक परिणाम के लिए सही प्राथमिकताओं का चयन और निरंतरता अनिवार्य है।`,
    ],
  };

  let chosenPools: Record<string, string[]>;
  if (language === 'Hindi') {
    chosenPools = isMobileTopic ? hindiMobileResponses : hindiGeneralResponses;
  } else {
    if (isMobileTopic) {
      chosenPools = englishMobileResponses;
    } else if (isBusinessTopic) {
      chosenPools = englishBusinessResponses;
    } else {
      chosenPools = englishGeneralResponses;
    }
  }

  const pool = chosenPools[selected.id] || chosenPools['moderator'];

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
