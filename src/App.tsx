import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { SetupScreen } from './components/SetupScreen';
import { Arena } from './components/Arena';
import { FeedbackReport } from './components/FeedbackReport';
import { ApiKeyModal } from './components/ApiKeyModal';
import type { SessionConfig, FeedbackReportData, Message } from './types';

export function App() {
  const [currentView, setCurrentView] = useState<'setup' | 'arena' | 'feedback'>('setup');
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  const [feedbackReport, setFeedbackReport] = useState<FeedbackReportData | null>(null);
  const [sessionTranscript, setSessionTranscript] = useState<Message[]>([]);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  const handleStartSession = (config: SessionConfig) => {
    setSessionConfig(config);
    setFeedbackReport(null);
    setSessionTranscript([]);
    setCurrentView('arena');
  };

  const handleSessionComplete = (report: FeedbackReportData, transcript: Message[]) => {
    setFeedbackReport(report);
    setSessionTranscript(transcript);
    setCurrentView('feedback');
  };

  const handleRestart = () => {
    setSessionConfig(null);
    setFeedbackReport(null);
    setSessionTranscript([]);
    setCurrentView('setup');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <Navbar
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        inSession={currentView === 'arena'}
      />

      <main className="flex-1 flex flex-col">
        {currentView === 'setup' && (
          <SetupScreen
            onStartSession={handleStartSession}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          />
        )}

        {currentView === 'arena' && sessionConfig && (
          <Arena
            config={sessionConfig}
            onSessionComplete={handleSessionComplete}
            onExitSession={handleRestart}
          />
        )}

        {currentView === 'feedback' && feedbackReport && (
          <FeedbackReport
            report={feedbackReport}
            transcript={sessionTranscript}
            onRestart={handleRestart}
          />
        )}
      </main>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeySaved={(_key) => {
          // Re-render handled by local state
        }}
      />
    </div>
  );
}

export default App;
