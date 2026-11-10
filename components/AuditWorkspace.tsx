'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  FileCheck2,
  ChevronLeft,
  Clock,
  Layers,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Info,
  Check,
  Flame,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { PRMStandard } from '@/lib/default-standards';
import { sanitizeAndRedact } from '@/lib/security';

interface Message {
  id?: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  tqmStep?: string;
}

interface AuditWorkspaceProps {
  auditId: string;
  userId: string;
  employeeName: string;
  department: string;
  roleTitle: string;
  officeLocation: string;
  processName: string;
  standard: PRMStandard | null;
  initialMessages?: Message[];
  onBack: () => void;
  onViewReport: (reportData: any) => void;
}

export const TQM_PHASES = [
  {
    id: 'step_mapping',
    stepNumber: 1,
    label: 'Step Mapping',
    desc: 'Map sequential tasks & systems',
    milestoneTurns: 1,
  },
  {
    id: 'friction_analysis',
    stepNumber: 2,
    label: 'Friction Analysis',
    desc: 'Expose bottlenecks & duplicate entry',
    milestoneTurns: 3,
  },
  {
    id: 'root_cause',
    stepNumber: 3,
    label: '5 Whys Root Cause',
    desc: 'Probe underlying systemic drivers',
    milestoneTurns: 5,
  },
  {
    id: 'benchmark_comparison',
    stepNumber: 4,
    label: 'SOP Comparison',
    desc: 'Evaluate against PRM agency standards',
    milestoneTurns: 7,
  },
  {
    id: 'pdca_synthesis',
    stepNumber: 5,
    label: 'PDCA Synthesis',
    desc: 'Formulate corrective action cycle',
    milestoneTurns: 9,
  },
];

function getInitialQuickReplies(dept: string, proc: string): string[] {
  const d = (dept || '').toLowerCase();
  const p = (proc || '').toLowerCase();
  if (d.includes('commercial') || p.includes('certificate') || p.includes('coi')) {
    return [
      'We receive COI requests via email and compare against policy schedules.',
      'Checking additional insured and waiver endorsements causes the longest delay.',
      'Carrier underwriting responses average 3 to 5 business days.',
    ];
  }
  if (d.includes('personal') || p.includes('renewal')) {
    return [
      'We pull the AMS360 renewal expiration list 45 to 60 days in advance.',
      'We contact the insured by phone and follow up with a review email.',
      'Remarketing is initiated if renewal premium increases exceed 10%.',
    ];
  }
  if (d.includes('sales') || d.includes('advisor') || p.includes('lead') || p.includes('quote')) {
    return [
      'New leads are entered and tracked in AgencyZoom before initial outreach.',
      'We schedule a discovery call to gather risk profiles and prior loss runs.',
      'Carrier quote comparisons currently require duplicate data entry.',
    ];
  }
  if (d.includes('reception') || d.includes('communication') || p.includes('call')) {
    return [
      'Calls arrive via RingCentral and are routed by policy type.',
      'When specialists are unavailable, we log an AMS360 activity note.',
      'Handoff confirmation lacks an automated status alert.',
    ];
  }
  if (d.includes('operations') || d.includes('admin')) {
    return [
      'Daily IVANS download exceptions are reviewed each morning in AMS360.',
      'Suspense tracking ensures policy change documentation is archived.',
      'Commission reconciliation requires matching carrier statements manually.',
    ];
  }
  return [
    `Here is how the initial trigger and workflow steps begin for ${proc}.`,
    'We frequently run into delays waiting for client responses or carrier quotes.',
    'There is duplicate data entry between AMS360 and external portals.',
  ];
}

export const AuditWorkspace: React.FC<AuditWorkspaceProps> = ({
  auditId,
  userId,
  employeeName,
  department,
  roleTitle,
  officeLocation,
  processName,
  standard,
  initialMessages = [],
  onBack,
  onViewReport,
}) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('step_mapping');
  const [quickReplies, setQuickReplies] = useState<string[]>(() =>
    getInitialQuickReplies(department, processName)
  );
  const [readyForReport, setReadyForReport] = useState(false);
  const [modelUsed, setModelUsed] = useState<string>('gemini-3.6-flash');
  const [redactionNotice, setRedactionNotice] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initialTurnStarted = useRef(false);

  // Calculate current active phase index (0 to 4)
  const currentPhaseIndex = Math.max(
    0,
    TQM_PHASES.findIndex((p) => p.id === currentPhase)
  );

  const persistInteraction = React.useCallback(
    async (msg: Message, step: string) => {
      try {
        setSaveStatus('saving');
        const interactionCol = collection(db, 'users', userId, 'audits', auditId, 'interactions');
        const randomSuffix = Math.random().toString(36).substring(2, 9);
        await addDoc(interactionCol, {
          id: `msg-${randomSuffix}`,
          userId,
          auditId,
          sender: msg.sender,
          content: msg.content,
          tqmStep: step,
          createdAt: new Date().toISOString(),
        });

        // Update audit master document state
        const auditDocRef = doc(db, 'users', userId, 'audits', auditId);
        await setDoc(
          auditDocRef,
          {
            id: auditId,
            userId,
            employeeName,
            department,
            roleTitle,
            officeLocation,
            processName,
            standardId: standard?.id || 'none',
            standardCode: standard?.code || 'UNVERIFIED',
            status: 'in_progress',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to persist audit interaction:', err);
        setSaveStatus('error');
        try {
          handleFirestoreError(err, OperationType.WRITE, `users/${userId}/audits/${auditId}`);
        } catch {
          // logged
        }
      }
    },
    [auditId, userId, employeeName, department, roleTitle, officeLocation, processName, standard]
  );

  const triggerInitialTurn = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId,
          userId,
          department,
          roleTitle,
          officeLocation,
          processName,
          standard,
          messages: [],
          currentInput: `Hello, I am ready to begin a structured TQM quality audit on "${processName}". My role is ${roleTitle} in ${department} (${officeLocation}).`,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        const step = data.meta?.tqmPhase || 'step_mapping';
        const assistantMsg: Message = {
          sender: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
          tqmStep: step,
        };
        setMessages([assistantMsg]);
        if (data.meta?.suggestedQuickReplies) {
          setQuickReplies(data.meta.suggestedQuickReplies);
        }
        if (data.meta?.tqmPhase) {
          setCurrentPhase(data.meta.tqmPhase);
        }
        if (data.modelUsed) {
          setModelUsed(data.modelUsed);
        }
        await persistInteraction(assistantMsg, step);
      }
    } catch (err) {
      console.error('Initial chat turn error:', err);
    } finally {
      setLoading(false);
    }
  }, [auditId, userId, department, roleTitle, officeLocation, processName, standard, persistInteraction]);

  // Initial greeting if no messages
  useEffect(() => {
    if (!initialTurnStarted.current && messages.length === 0) {
      initialTurnStarted.current = true;
      triggerInitialTurn();
    }
  }, [messages.length, triggerInitialTurn]);

  const handleSendMessage = async (textToSend?: string) => {
    const rawInput = textToSend !== undefined ? textToSend : inputText;
    if (!rawInput.trim() || loading) return;

    // Redaction and sanitization
    const { sanitizedText, warnings } = sanitizeAndRedact(rawInput);
    if (warnings.length > 0) {
      setRedactionNotice(warnings.join(' '));
      setTimeout(() => setRedactionNotice(null), 5000);
    }

    const userMsg: Message = {
      sender: 'user',
      content: sanitizedText,
      timestamp: new Date().toISOString(),
      tqmStep: currentPhase,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);

    await persistInteraction(userMsg, currentPhase);

    try {
      const res = await fetch('/api/audit/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId,
          userId,
          department,
          roleTitle,
          officeLocation,
          processName,
          standard,
          messages: newMessages,
          currentInput: sanitizedText,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        const step = data.meta?.tqmPhase || currentPhase;
        const assistantMsg: Message = {
          sender: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
          tqmStep: step,
        };
        setMessages([...newMessages, assistantMsg]);

        if (data.meta?.suggestedQuickReplies) {
          setQuickReplies(data.meta.suggestedQuickReplies);
        }
        if (data.meta?.tqmPhase) {
          setCurrentPhase(data.meta.tqmPhase);
        }
        if (data.meta?.readyForReport !== undefined) {
          setReadyForReport(data.meta.readyForReport || newMessages.length >= 6);
        }
        if (data.modelUsed) {
          setModelUsed(data.modelUsed);
        }
        await persistInteraction(assistantMsg, step);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch('/api/audit/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId,
          department,
          roleTitle,
          officeLocation,
          processName,
          standard,
          messages,
          employeeName,
        }),
      });

      const data = await res.json();
      if (data.report) {
        // Persist final report in Firestore audit document
        const auditDocRef = doc(db, 'users', userId, 'audits', auditId);
        await setDoc(
          auditDocRef,
          {
            id: auditId,
            userId,
            employeeName,
            department,
            roleTitle,
            officeLocation,
            processName,
            standardId: standard?.id || 'none',
            standardCode: standard?.code || 'UNVERIFIED',
            status: 'completed',
            classification: data.report.classification || 'partial_gap',
            priority: data.report.priority || 'medium',
            findings: JSON.stringify(data.report.verifiedFindings || []),
            rootCauses: JSON.stringify(data.report.rootCauseAnalysis || {}),
            pdcaPlan: JSON.stringify(data.report.pdcaPlan || {}),
            kpiIndicators: JSON.stringify(data.report.kpiIndicators || []),
            recommendations: JSON.stringify(data.report.recommendedCorrectiveActions || []),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        onViewReport(data.report);
      }
    } catch (err) {
      console.error('Report generation error:', err);
    } finally {
      setGeneratingReport(false);
    }
  };

  const isEligibleForReport = messages.length >= 4 || readyForReport;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
      {/* Breadcrumb & Navigation Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <div className="flex items-center space-x-1.5 truncate">
          <button
            onClick={onBack}
            className="hover:text-slate-900 font-semibold transition-colors flex items-center space-x-1"
          >
            <span>My Audits</span>
          </button>
          <span>/</span>
          <span className="text-[#0096AF] font-bold">{department}</span>
          <span>/</span>
          <span className="text-slate-800 font-medium truncate max-w-xs">{processName}</span>
        </div>

        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1 text-slate-600 hover:text-slate-900 font-semibold text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Exit Workspace</span>
        </button>
      </div>

      {/* Audit Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 mb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0096AF] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0096AF] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {department}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-medium text-slate-600">
                  {roleTitle} ({officeLocation})
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-mono text-slate-500">{auditId}</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">{processName}</h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Active Model Resilience Indicator */}
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200 text-slate-700 text-xs font-mono">
              <Cpu className="w-3.5 h-3.5 text-[#0096AF]" />
              <span>{modelUsed}</span>
            </div>

            {/* Firestore Auto-save status */}
            <div className="flex items-center space-x-1 text-xs text-slate-500 font-medium px-2 py-1">
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  saveStatus === 'saved' ? 'text-emerald-500' : 'text-amber-500'
                }`}
              />
              <span className="capitalize">{saveStatus}</span>
            </div>

            {/* Generate Report CTA */}
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport || messages.length < 2}
              className={`px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 ${
                isEligibleForReport
                  ? 'bg-[#DC582A] hover:bg-[#c24c22] text-white shadow-md'
                  : 'bg-[#0096AF] hover:bg-[#008197] text-white disabled:opacity-40'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>{generatingReport ? 'Synthesizing...' : 'Generate TQM Report'}</span>
            </button>
          </div>
        </div>

        {/* Enhanced 5-Phase TQM Progress Stepper */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-[#0096AF]" />
              <span>Audit Progression Stages:</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Turn {Math.max(1, Math.floor(messages.length / 2))} • Phase {currentPhaseIndex + 1} of 5
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {TQM_PHASES.map((phase, idx) => {
              const isCurrent = currentPhase === phase.id;
              const isPast = idx < currentPhaseIndex;

              return (
                <div
                  key={phase.id}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    isCurrent
                      ? 'bg-teal-50/90 border-[#0096AF] shadow-xs ring-1 ring-[#0096AF]'
                      : isPast
                      ? 'bg-slate-50/80 border-emerald-300 text-slate-700'
                      : 'bg-slate-50 border-slate-200 opacity-60 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                        isCurrent
                          ? 'bg-[#0096AF] text-white'
                          : isPast
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      Step {phase.stepNumber}
                    </span>
                    {isPast && <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />}
                    {isCurrent && (
                      <span className="w-2 h-2 rounded-full bg-[#0096AF] animate-ping" />
                    )}
                  </div>
                  <div
                    className={`text-xs font-bold truncate ${
                      isCurrent ? 'text-[#0096AF]' : isPast ? 'text-slate-800' : 'text-slate-600'
                    }`}
                  >
                    {phase.label}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{phase.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Redaction Notice Alert */}
      {redactionNotice && (
        <div className="p-2.5 mb-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center space-x-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{redactionNotice}</span>
        </div>
      )}

      {/* Benchmark Standard Reference Bar (if linked) */}
      {standard && (
        <div className="px-3 py-1.5 mb-2 bg-slate-100/90 border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800">Benchmark Standard:</span>
            <span className="font-mono text-slate-700">{standard.code} v{standard.version}</span>
            <span>-</span>
            <span className="truncate max-w-md">{standard.title}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            Active SOP
          </span>
        </div>
      )}

      {/* Conversational Chat Transcript */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-xs mb-3">
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-2xl rounded-xl p-4 shadow-2xs ${
                  isUser
                    ? 'bg-[#0096AF] text-white rounded-br-none'
                    : 'bg-slate-50 text-slate-800 border border-slate-200 rounded-bl-none'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 space-x-2">
                  <span className={`text-[11px] font-bold ${isUser ? 'text-teal-100' : 'text-slate-600'}`}>
                    {isUser ? employeeName || 'Employee' : 'PRM TQM Quality Auditor (AI)'}
                  </span>
                  {msg.tqmStep && !isUser && (
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-teal-100/80 text-[#0096AF]">
                      {msg.tqmStep.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-50 text-slate-700 border border-slate-200 rounded-xl rounded-bl-none p-4 max-w-md shadow-2xs flex items-center space-x-2.5">
              <Sparkles className="w-4 h-4 text-[#0096AF] animate-spin" />
              <span className="text-xs font-medium">Auditing workflow & probing root causes...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Dynamic Context-Aware Quick Response Pills */}
      {quickReplies.length > 0 && !loading && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
          <div className="flex items-center space-x-1 shrink-0 text-[#0096AF] bg-teal-50 px-2.5 py-1.5 rounded-md border border-teal-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Tailored Quick Prompts:
            </span>
          </div>
          {quickReplies.map((reply, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(reply)}
              className="text-xs bg-white hover:bg-teal-50 text-slate-700 hover:text-[#0096AF] border border-slate-200 hover:border-[#0096AF] px-3.5 py-1.5 rounded-full transition-all shrink-0 shadow-2xs text-left max-w-sm truncate"
              title={`Click to send: "${reply}"`}
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input Message Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Describe your workflow steps, bottlenecks, recurring errors, or handoffs..."
          disabled={loading}
          className="flex-1 text-xs sm:text-sm px-3 py-2 bg-transparent focus:outline-hidden text-slate-800 placeholder-slate-400"
        />
        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="p-2.5 bg-[#0096AF] hover:bg-[#008197] text-white rounded-lg transition-colors disabled:opacity-40"
          title="Send message to auditor"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
