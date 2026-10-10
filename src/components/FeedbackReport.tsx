import React, { useState } from 'react';
import {
  Trophy,
  CheckCircle,
  AlertCircle,
  Quote,
  Lightbulb,
  Copy,
  Download,
  RotateCcw,
  BarChart2,
  FileText,
  Check,
} from 'lucide-react';
import type { FeedbackReportData, Message } from '../types';

interface FeedbackReportProps {
  report: FeedbackReportData;
  transcript: Message[];
  onRestart: () => void;
}

export const FeedbackReport: React.FC<FeedbackReportProps> = ({
  report,
  transcript,
  onRestart,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'quotes' | 'transcript'>('metrics');

  const handleCopyReport = () => {
    const textSummary = `GD Arena - Performance Evaluation
Candidate: ${report.candidateName}
Topic: ${report.topic}
Overall Score: ${report.overallScore}/10 (${report.verdict})

Executive Summary:
${report.executiveSummary}

Pillars Evaluated:
1. Idea Quality: ${report.metrics.ideaQuality.score}/10 (${report.metrics.ideaQuality.verdict})
2. Listening Skills: ${report.metrics.listeningSkills.score}/10 (${report.metrics.listeningSkills.verdict})
3. Handling Interruptions: ${report.metrics.handlingInterruptions.score}/10 (${report.metrics.handlingInterruptions.verdict})

Actionable Coaching Tips:
${report.actionableTips.map((tip, i) => `${i + 1}. ${tip}`).join('\n')}
`;
    navigator.clipboard.writeText(textSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscript = () => {
    const fullText = transcript
      .map((m) => `[${m.timestamp}] ${m.speaker}: "${m.text}"`)
      .join('\n\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GD-Arena-Transcript-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-8 animate-fadeIn">
      {/* Top Banner: Score Card & Overall Verdict */}
      <div className="relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/80 border border-indigo-500/30 rounded-3xl shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-xs font-semibold text-indigo-400">
              <Trophy className="w-3.5 h-3.5" />
              <span>Assessment Completed • {report.durationMinutes} Min Session</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Performance Evaluation Report
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Topic: <span className="text-indigo-200">"{report.topic}"</span>
            </p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed pt-1">
              {report.executiveSummary}
            </p>
          </div>

          {/* Big Score Dial */}
          <div className="flex flex-col items-center justify-center p-5 bg-slate-950/80 border border-indigo-500/40 rounded-2xl shadow-xl min-w-[170px] self-center md:self-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Overall GD Score
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                {report.overallScore.toFixed(1)}
              </span>
              <span className="text-slate-500 text-base font-bold">/10</span>
            </div>
            <span className="text-xs font-semibold text-emerald-400 text-center">
              {report.verdict}
            </span>
          </div>
        </div>

        {/* Action bar */}
        <div className="relative z-10 mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
            </button>
            <button
              onClick={handleDownloadTranscript}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Raw Transcript</span>
            </button>
          </div>

          <button
            onClick={onRestart}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Practice Another GD</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'metrics'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Core Evaluation Pillars</span>
        </button>
        <button
          onClick={() => setActiveTab('quotes')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'quotes'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Quote className="w-4 h-4" />
          <span>Verbatim Quoted Evidence</span>
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'transcript'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Full Discussion Transcript</span>
        </button>
      </div>

      {/* Tab 1: 3-Pillar Breakdown */}
      {activeTab === 'metrics' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1: Idea Quality */}
            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-indigo-400">
                    Pillar 1
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded-md">
                    {report.metrics.ideaQuality.verdict}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">Idea Quality</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {report.metrics.ideaQuality.analysis}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400">Score</span>
                <span className="text-xl font-black text-indigo-300 font-mono">
                  {report.metrics.ideaQuality.score.toFixed(1)}/10
                </span>
              </div>
            </div>

            {/* Pillar 2: Listening Skills */}
            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-purple-400">
                    Pillar 2
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded-md">
                    {report.metrics.listeningSkills.verdict}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">Listening Skills</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {report.metrics.listeningSkills.analysis}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400">Score</span>
                <span className="text-xl font-black text-purple-300 font-mono">
                  {report.metrics.listeningSkills.score.toFixed(1)}/10
                </span>
              </div>
            </div>

            {/* Pillar 3: Handling Interruptions */}
            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-pink-400">
                    Pillar 3
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-pink-500/10 text-pink-300 rounded-md">
                    {report.metrics.handlingInterruptions.verdict}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">Handling Interruptions</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {report.metrics.handlingInterruptions.analysis}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400">Score</span>
                <span className="text-xl font-black text-pink-300 font-mono">
                  {report.metrics.handlingInterruptions.score.toFixed(1)}/10
                </span>
              </div>
            </div>
          </div>

          {/* Strengths vs Growth Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-3">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Observed Key Strengths</span>
              </h4>
              <ul className="space-y-2">
                {report.keyStrengths.map((str, i) => (
                  <li key={i} className="text-xs text-emerald-200/90 flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-3">
              <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Areas for Development</span>
              </h4>
              <ul className="space-y-2">
                {report.areasForImprovement.map((area, i) => (
                  <li key={i} className="text-xs text-amber-200/90 flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actionable Tips */}
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span>Actionable Coaching Recommendations</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {report.actionableTips.map((tip, i) => (
                <div key={i} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    Tip #{i + 1}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Verbatim Quoted Evidence */}
      {activeTab === 'quotes' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
            Below are verbatim quotes spoken by you during the discussion, along with the AI evaluator's contextual rationale.
          </div>

          {/* Grouped Quotes by Pillar */}
          {Object.entries(report.metrics).map(([key, data]) => (
            <div key={key} className="space-y-3">
              <h3 className="text-sm font-bold text-slate-200 capitalize flex items-center gap-2">
                <Quote className="w-4 h-4 text-indigo-400" />
                <span>{key.replace(/([A-Z])/g, ' $1')} Quoted Evidence</span>
              </h3>

              <div className="space-y-3">
                {data.quotes.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <Quote className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-indigo-200 italic">
                        "{item.quote}"
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                      <div>
                        <span className="font-semibold text-slate-400">Context: </span>
                        <span className="text-slate-300">{item.context}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-400">Feedback: </span>
                        <span className="text-slate-300">{item.comment}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Full Transcript Replay */}
      {activeTab === 'transcript' && (
        <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">Full Verbatim Transcript</h3>
            <span className="text-xs text-slate-400">{transcript.length} turns recorded</span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {transcript.map((msg) => (
              <div
                key={msg.id}
                className={`p-3.5 rounded-xl border text-xs sm:text-sm ${
                  msg.isUser
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span
                    className={`font-bold ${
                      msg.isUser ? 'text-emerald-400' : 'text-indigo-300'
                    }`}
                  >
                    {msg.speaker}
                  </span>
                  <span className="text-slate-500 font-mono">{msg.timestamp}</span>
                </div>
                <p className="text-slate-200 leading-relaxed font-sans">
                  "{msg.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
