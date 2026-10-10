# 🎙️ GD Arena — Voice-First Group Discussion Practice Simulator

> Built for the 16-Hour Hackathon: A real-time, voice-first group discussion practice room pitting candidates against diverse AI personalities with sub-second turn-taking, active speaker soundwaves, and verbatim post-GD feedback.

---

## ⚡ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons
- **Speech-to-Text (STT)**: Native Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) with continuous streaming & silence debounce.
- **Text-to-Speech (TTS)**: Native Web Speech API (`window.speechSynthesis`) with distinct vocal pitch/rate personalities.
- **LLM Orchestration**: Groq Cloud API (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`) with an intelligent offline Simulation Fallback for zero-latency demoing.

---

## 🏛️ Architecture & Flow

```
[ Setup Screen ] ───────────► [ The Arena (Live Room) ] ──────────► [ Feedback Report ]
- 3 Curated Topics + Custom   - Circular Pod Seating              - Overall GD Score (0-10)
- 3 to 5 AI Discussants       - Glowing Halo on Speaker           - 3 Pillars:
- Mic Permission Check        - Animated Soundwaves (TTS/STT)       1. Idea Quality
- User Profile Name           - 10-Minute Countdown Clock           2. Listening Skills
                              - Continuous STT Transcription        3. Interruption Handling
                              - Dynamic Groq Turn Taking          - Verbatim Quoted Evidence
                              - "Force AI to Speak" Fallback      - Speaking Time Distribution
                              - Interruption Detection & Yield    - Raw Transcript Export
```

---

## 🎭 AI Discussants Lineup

1. **The Moderator (⚖️)**: Balances divergent viewpoints, synthesizes arguments, and invites quieter members.
2. **The Data Nerd (📊)**: Demands empirical numbers, metrics, unit economics, and counters emotional claims.
3. **The Dominator (⚡)**: Bold, assertive, challenges assumptions, tests candidate floor control and poise.
4. **The Quiet One (🌿)**: Delivers razor-sharp ethical, human, and subtle philosophical insights.
5. **The Devil's Advocate (🎭)**: Contrarian critical thinker who probes consensus for blind spots.

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the Vite development server
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 🔑 Groq API Key Setup

- Click the **Groq / Simulation** button in the top navbar.
- Paste your Groq API key (`gsk_...`) and click **Save & Connect**.
- **Hackathon Demo Guarantee**: If no key is entered, GD Arena seamlessly activates its built-in realistic simulation engine, ensuring judge demos never fail or stall due to rate limits!
