'use client';

import React, { useState } from 'react';
import {
  FileCheck2,
  ChevronLeft,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Target,
  RefreshCw,
  PlusCircle,
  Copy,
  Check,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';

interface AuditReportViewProps {
  report: any;
  auditId: string;
  department: string;
  processName: string;
  roleTitle: string;
  officeLocation: string;
  employeeName: string;
  userEmail: string;
  onBack: () => void;
  onActionCreated?: () => void;
}

export const CLASSIFICATION_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  conforms: {
    label: 'Conforms to Standards',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    desc: 'Practices align with documented PRM Standard Operating Procedures.',
  },
  partial_gap: {
    label: 'Partial Gap',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    desc: 'Core workflow functional, but specific operational friction or missing checkpoints exist.',
  },
  process_gap: {
    label: 'Process Gap',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-300',
    desc: 'Meaningful divergence from PRM standards or critical control missing.',
  },
  improvement_opportunity: {
    label: 'Improvement Opportunity',
    bg: 'bg-teal-50',
    text: 'text-[#0096AF]',
    border: 'border-teal-300',
    desc: 'Compliant workflow with high-leverage opportunity for automation or efficiency.',
  },
  not_verified: {
    label: 'Not Verified',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300',
    desc: 'No formal approved benchmark standard available or further evidence required.',
  },
};

export const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  high: { label: 'High Priority', bg: 'bg-rose-100', text: 'text-rose-800' },
  medium: { label: 'Medium Priority', bg: 'bg-amber-100', text: 'text-amber-800' },
  low: { label: 'Low Priority', bg: 'bg-emerald-100', text: 'text-emerald-800' },
};

export const AuditReportView: React.FC<AuditReportViewProps> = ({
  report,
  auditId,
  department,
  processName,
  roleTitle,
  officeLocation,
  employeeName,
  userEmail,
  onBack,
  onActionCreated,
}) => {
  const [creatingAction, setCreatingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const classification = report.classification || 'partial_gap';
  const classMeta = CLASSIFICATION_CONFIG[classification] || CLASSIFICATION_CONFIG.partial_gap;
  const priority = report.priority || 'medium';
  const priorityMeta = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;

  const handleCreateImprovementAction = async () => {
    setCreatingAction(true);
    setActionError(null);
    try {
      const actionId = 'ACT-' + Date.now();
      const firstAction = report.recommendedCorrectiveActions?.[0] || 'Implement procedural checkpoint in AMS360.';
      const problem = report.summary || report.employeeChallenges?.[0] || 'Operational friction identified in audit.';
      const safePriority = String(priority).toLowerCase();
      const normalizedPriority = ['low', 'medium', 'high'].includes(safePriority) ? safePriority : 'medium';

      await setDoc(doc(db, 'actions', actionId), {
        id: actionId,
        auditId: auditId || 'AUD-REF',
        department: department || 'General Agency',
        processName: processName || 'Workflow Evaluation',
        problemStatement: problem,
        correctiveAction: firstAction,
        pdcaPhase: 'plan',
        status: 'identified',
        priority: normalizedPriority,
        assignedOwner: report.suggestedOwner || `${department} Team Lead`,
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        verificationResult: 'Pending PDCA baseline measurement.',
        notes: `Created from Audit Report: ${report.auditTitle || processName}`,
        createdByUser: userEmail || 'Staff Member',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setActionSuccess(true);
      if (onActionCreated) onActionCreated();
      setTimeout(() => setActionSuccess(false), 5000);
    } catch (err: any) {
      console.error('Failed to create improvement action:', err);
      setActionError(err?.message || 'Failed to persist PDCA action to Firestore.');
      try {
        handleFirestoreError(err, OperationType.CREATE, 'actions');
      } catch (e) {
        // logged via handleFirestoreError
      }
    } finally {
      setCreatingAction(false);
    }
  };

  const handleCopyText = () => {
    const text = `PRM QUALITY AUDIT REPORT\n${report.auditTitle || processName}\n\nConclusion:\n${report.conclusion}\n\nClassification: ${classMeta.label}\nPriority: ${priorityMeta.label}\n\nPDCA Plan:\nPlan: ${report.pdcaPlan?.plan}\nDo: ${report.pdcaPlan?.do}\nCheck: ${report.pdcaPlan?.check}\nAct: ${report.pdcaPlan?.act}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Audit Workspace</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyText}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors border border-slate-200"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Summary'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors border border-slate-200"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleCreateImprovementAction}
            disabled={creatingAction}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-[#DC582A] hover:bg-[#c24c22] px-3.5 py-1.5 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{creatingAction ? 'Creating Action...' : 'Track as PDCA Action'}</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Successfully created organizational PDCA Improvement Action! Viewable in Admin Dashboard and Action Tracker.
          </span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            Unable to track PDCA Action: {actionError}
          </span>
        </div>
      )}

      {/* Main Report Document Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-10 space-y-8">
        {/* Header Branding */}
        <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0096AF]">
              <span>Priority Risk Management</span>
              <span>•</span>
              <span>Total Quality Management (TQM)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {report.auditTitle || `Process Quality Audit: ${processName}`}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">Audit Reference ID: {auditId}</p>
          </div>

          <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${classMeta.bg} ${classMeta.text} ${classMeta.border}`}
            >
              {classMeta.label}
            </span>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${priorityMeta.bg} ${priorityMeta.text}`}>
              {priorityMeta.label}
            </span>
          </div>
        </div>

        {/* Audit Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Department</span>
            <span className="font-bold text-slate-800">{department}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Audited Role</span>
            <span className="font-bold text-slate-800">{roleTitle}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">PRM Office Location</span>
            <span className="font-bold text-slate-800">{officeLocation}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Employee Participant</span>
            <span className="font-bold text-slate-800">{employeeName || 'Staff Member'}</span>
          </div>
        </div>

        {/* Executive Summary */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2 mb-2">
            <Sparkles className="w-4 h-4 text-[#0096AF]" />
            <span>1. Executive Summary & Assessment</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
            {report.summary || 'Audit conducted using TQM continuous process improvement framework.'}
          </p>
        </div>

        {/* Workflow Steps vs Employee Challenges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 bg-teal-50/30 rounded-xl border border-teal-100">
            <h4 className="text-xs font-bold text-[#0096AF] uppercase tracking-wide mb-3 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Current Workflow Path (As Disclosed)</span>
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 leading-relaxed">
              {report.workflowSteps?.map((step: string, i: number) => (
                <li key={i} className="pl-1">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="p-5 bg-amber-50/30 rounded-xl border border-amber-100">
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-3 flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Reported Friction & Bottlenecks</span>
            </h4>
            <ul className="list-disc list-inside space-y-2 text-xs text-slate-700 leading-relaxed">
              {report.employeeChallenges?.map((ch: string, i: number) => (
                <li key={i} className="pl-1">
                  {ch}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Root Cause Analysis (5 Whys / Fishbone) */}
        <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
              <Target className="w-4 h-4 text-[#DC582A]" />
              <span>Root Cause Analysis ({report.rootCauseAnalysis?.technique || '5 Whys Methodology'})</span>
            </h3>
            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              Evidence-Based
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-700">
            {report.rootCauseAnalysis?.causes?.map((cause: string, i: number) => (
              <div key={i} className="flex items-start space-x-2 bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-[#DC582A] text-xs shrink-0">Level {i + 1}:</span>
                <span className="leading-relaxed">{cause}</span>
              </div>
            ))}
          </div>
        </div>

        {/* The PDCA Continuous Improvement Matrix */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-[#0096AF]" />
              <span>Total Quality Management: PDCA Cycle Matrix</span>
            </h3>
            <span className="text-xs text-slate-500">Plan-Do-Check-Act</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200">
              <div className="text-xs font-bold text-[#0096AF] uppercase tracking-wider mb-1">
                Plan
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{report.pdcaPlan?.plan || 'Define target baseline.'}</p>
            </div>

            <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-200">
              <div className="text-xs font-bold text-sky-800 uppercase tracking-wider mb-1">
                Do
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{report.pdcaPlan?.do || 'Implement pilot workflow.'}</p>
            </div>

            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200">
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
                Check
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{report.pdcaPlan?.check || 'Measure variance & turnaround.'}</p>
            </div>

            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200">
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                Act
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{report.pdcaPlan?.act || 'Standardize successful change.'}</p>
            </div>
          </div>
        </div>

        {/* Corrective Actions & KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center space-x-1.5">
              <ArrowRight className="w-4 h-4 text-[#DC582A]" />
              <span>Recommended Corrective Actions</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-700">
              {report.recommendedCorrectiveActions?.map((act: string, i: number) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{act}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-[#0096AF]" />
              <span>Measurable Quality Indicators (KPIs)</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-700">
              {report.kpiIndicators?.map((kpi: string, i: number) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0096AF] shrink-0 mt-1.5" />
                  <span className="leading-relaxed">{kpi}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Operational Impact & Responsible Owner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Operational Impact Rationale</span>
            <span className="text-slate-700 leading-relaxed block mt-0.5">
              {report.priorityRationale || 'Evaluated for agency workflow stability and policyholder experience.'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Suggested Process Owner</span>
            <span className="font-bold text-slate-900 block mt-0.5">
              {report.suggestedOwner || `${department} Operations Lead`}
            </span>
          </div>
        </div>

        {/* Audit Conclusion Box */}
        <div className="p-5 bg-teal-50/40 rounded-xl border border-teal-200">
          <h4 className="text-xs font-bold text-[#0096AF] uppercase tracking-wide mb-1.5">
            Final Audit Conclusion & Recommendation
          </h4>
          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
            {report.conclusion}
          </p>
          <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-teal-200/60">
            Note: All findings are advisory and designed for continuous quality improvement under PRM management review.
          </p>
        </div>
      </div>
    </div>
  );
};
