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
  Layers,
  Users,
  Cpu,
  Building,
  Clock,
  Briefcase,
  FileText,
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

  // Normalize data across structured 4-section schema and legacy fallbacks
  const s1 = report.section1_ProcessFindings || {};
  const s2 = report.section2_IdentifiedChallenges || {};
  const s3 = report.section3_PotentialRootCauses || {};
  const s4 = report.section4_RecommendedCorrectiveActions || {};

  const summary = s1.summary || report.summary || 'Audit conducted using TQM continuous process improvement framework.';
  const workflowSteps = s1.workflowSteps || report.workflowSteps || [];
  const classification = s1.classification || report.classification || 'partial_gap';
  const classMeta = CLASSIFICATION_CONFIG[classification] || CLASSIFICATION_CONFIG.partial_gap;
  const priority = s1.priority || report.priority || 'medium';
  const priorityMeta = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const priorityRationale = s1.priorityRationale || report.priorityRationale || 'Evaluated for agency operational stability and client service quality.';
  const slaAssessment = s1.slaAssessment || 'Evaluated against PRM departmental turnaround benchmarks.';

  // Section 2 Challenges
  const mainChallenges = s2.challenges || report.employeeChallenges || [];
  const bottlenecks = s2.bottlenecks || [];
  const reworkList = s2.reworkAndDuplicateEntry || [];
  const handoffs = s2.handoffFriction || [];

  // Section 3 Root Causes
  const rootCausesChain = s3.fiveWhysChain || report.rootCauseAnalysis?.causes || [];
  const ishikawa = s3.ishikawaCategories || {
    peopleAndRoles: [],
    processAndMethods: [],
    technologyAndSystems: [],
    carrierAndExternal: [],
  };

  // Section 4 Corrective Actions & PDCA
  const pdcaPlan = s4.pdcaMatrix || report.pdcaPlan || {};
  const actionItems = s4.actionItems || (report.recommendedCorrectiveActions || []).map((act: string) => ({
    action: act,
    rationale: 'Mitigates identified workflow bottleneck.',
    suggestedOwner: `${department} Team Lead`,
    targetTimeline: '30 Days',
    kpiMetric: 'Turnaround reduction & rework elimination',
  }));
  const kpis = s4.kpiIndicators || report.kpiIndicators || [];
  const conclusion = report.conclusion || 'Audit completed with continuous improvement opportunities identified.';

  const handleCreateImprovementAction = async () => {
    setCreatingAction(true);
    setActionError(null);
    try {
      const actionId = 'ACT-' + Date.now();
      const firstAction = actionItems[0]?.action || report.recommendedCorrectiveActions?.[0] || 'Implement standard operating procedure checklist.';
      const problem = summary || mainChallenges[0] || 'Workflow friction identified in audit.';
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
        assignedOwner: actionItems[0]?.suggestedOwner || report.suggestedOwner || `${department} Team Lead`,
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
      } catch {
        // logged via handleFirestoreError
      }
    } finally {
      setCreatingAction(false);
    }
  };

  const handleCopyText = () => {
    const text = `PRM QUALITY AUDIT REPORT
${report.auditTitle || processName}

1. PROCESS FINDINGS:
${summary}
Classification: ${classMeta.label}
Priority: ${priorityMeta.label}

2. IDENTIFIED CHALLENGES:
${mainChallenges.map((c: string) => `- ${c}`).join('\n')}

3. ROOT CAUSES (5 WHYS):
${rootCausesChain.map((rc: string, i: number) => `Level ${i + 1}: ${rc}`).join('\n')}

4. PDCA CONTINUOUS IMPROVEMENT MATRIX:
Plan: ${pdcaPlan?.plan}
Do: ${pdcaPlan?.do}
Check: ${pdcaPlan?.check}
Act: ${pdcaPlan?.act}

CONCLUSION:
${conclusion}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors self-start"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Audit Workspace</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
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
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Successfully created organizational PDCA Improvement Action! Viewable in Admin Dashboard and Action Tracker.
          </span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Unable to track PDCA Action: {actionError}</span>
        </div>
      )}

      {/* Main Report Document Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-10 space-y-8 print:border-none print:shadow-none print:p-0">
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
            <span className="text-slate-400 block font-medium">Office Location</span>
            <span className="font-bold text-slate-800">{officeLocation}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Employee Participant</span>
            <span className="font-bold text-slate-800">{employeeName || 'Staff Member'}</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 1: PROCESS FINDINGS & OPERATIONAL OVERVIEW       */}
        {/* ======================================================== */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-teal-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              <span className="w-6 h-6 rounded-md bg-teal-100 text-[#0096AF] flex items-center justify-center text-xs font-black">
                1
              </span>
              <span>Process Findings & Operational Overview</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">Executive Summary & SOP Alignment</span>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/90 space-y-2">
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
              {summary}
            </p>
            <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Impact Assessment:</span>
              <span>{priorityRationale}</span>
              <span>•</span>
              <span className="text-slate-500">{slaAssessment}</span>
            </div>
          </div>

          {workflowSteps.length > 0 && (
            <div className="p-4 bg-teal-50/30 rounded-xl border border-teal-100">
              <h4 className="text-xs font-bold text-[#0096AF] uppercase tracking-wide mb-2 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Documented Sequential Workflow Steps</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 leading-relaxed">
                {workflowSteps.map((step: string, i: number) => (
                  <li key={i} className="pl-1">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* SECTION 2: IDENTIFIED CHALLENGES & OPERATIONAL FRICTION  */}
        {/* ======================================================== */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-amber-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              <span className="w-6 h-6 rounded-md bg-amber-100 text-[#DC582A] flex items-center justify-center text-xs font-black">
                2
              </span>
              <span>Identified Challenges & Operational Friction</span>
            </h2>
            <span className="text-xs font-semibold text-amber-700">Bottlenecks, Delays & Manual Rework</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-amber-50/30 rounded-xl border border-amber-100 space-y-2">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Reported Inefficiencies & Obstacles</span>
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 leading-relaxed">
                {mainChallenges.map((ch: string, i: number) => (
                  <li key={i} className="pl-1">
                    {ch}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-slate-600" />
                <span>Turnaround & Carrier Portal Delays</span>
              </h4>
              {bottlenecks.length > 0 || reworkList.length > 0 || handoffs.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {bottlenecks.map((b: string, i: number) => (
                    <li key={'b-' + i} className="flex items-start space-x-1.5">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                  {reworkList.map((r: string, i: number) => (
                    <li key={'r-' + i} className="flex items-start space-x-1.5">
                      <span className="text-rose-600 font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                  {handoffs.map((h: string, i: number) => (
                    <li key={'h-' + i} className="flex items-start space-x-1.5">
                      <span className="text-sky-600 font-bold">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Operational delays primarily stem from manual duplicate entry across external carrier portals and asynchronous client document turnaround.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 3: POTENTIAL ROOT CAUSES (5 WHYS & ISHIKAWA)     */}
        {/* ======================================================== */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-rose-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              <span className="w-6 h-6 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-black">
                3
              </span>
              <span>Potential Root Causes (5 Whys & Ishikawa Analysis)</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">Causal Drill-Down & Failure Modes</span>
          </div>

          {/* 5 Whys Chain */}
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
                <Target className="w-4 h-4 text-[#DC582A]" />
                <span>Five Whys Causal Chain</span>
              </h4>
              <span className="text-[10px] font-bold text-[#DC582A] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Symptom → Root Cause
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              {rootCausesChain.map((cause: string, i: number) => {
                const isRoot = i === rootCausesChain.length - 1;
                return (
                  <div
                    key={i}
                    className={`flex items-start space-x-2.5 p-3 rounded-lg border transition-all ${
                      isRoot
                        ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-300 text-rose-950 font-medium'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <span
                      className={`text-xs font-black shrink-0 px-1.5 py-0.5 rounded ${
                        isRoot ? 'bg-rose-600 text-white' : 'bg-slate-100 text-[#DC582A]'
                      }`}
                    >
                      {isRoot ? 'Root Cause' : `Why ${i + 1}`}
                    </span>
                    <span className="leading-relaxed">{cause}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ishikawa 4M Failure Mode Grid */}
          {(ishikawa.peopleAndRoles?.length > 0 ||
            ishikawa.processAndMethods?.length > 0 ||
            ishikawa.technologyAndSystems?.length > 0 ||
            ishikawa.carrierAndExternal?.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  <Users className="w-3.5 h-3.5 text-[#0096AF]" />
                  <span>People & Roles</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1">
                  {ishikawa.peopleAndRoles.map((item: string, i: number) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Process & Methods</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1">
                  {ishikawa.processAndMethods.map((item: string, i: number) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  <Cpu className="w-3.5 h-3.5 text-sky-600" />
                  <span>Technology & AMS360</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1">
                  {ishikawa.technologyAndSystems.map((item: string, i: number) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Carrier & External</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1">
                  {ishikawa.carrierAndExternal.map((item: string, i: number) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* SECTION 4: RECOMMENDED CORRECTIVE ACTIONS & PDCA MATRIX  */}
        {/* ======================================================== */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-teal-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              <span className="w-6 h-6 rounded-md bg-teal-100 text-[#0096AF] flex items-center justify-center text-xs font-black">
                4
              </span>
              <span>Recommended Corrective Actions & PDCA Matrix</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">Plan-Do-Check-Act Continuous Improvement</span>
          </div>

          {/* The PDCA Continuous Improvement Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200">
              <div className="text-xs font-bold text-[#0096AF] uppercase tracking-wider mb-1 flex items-center space-x-1">
                <span>Plan</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{pdcaPlan?.plan || 'Establish baseline standards.'}</p>
            </div>

            <div className="p-4 bg-sky-50/60 rounded-xl border border-sky-200">
              <div className="text-xs font-bold text-sky-800 uppercase tracking-wider mb-1 flex items-center space-x-1">
                <span>Do</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{pdcaPlan?.do || 'Implement pilot workflow change.'}</p>
            </div>

            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200">
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center space-x-1">
                <span>Check</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{pdcaPlan?.check || 'Track turnaround time and error variance.'}</p>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center space-x-1">
                <span>Act</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{pdcaPlan?.act || 'Standardize successful change in agency SOP.'}</p>
            </div>
          </div>

          {/* Prioritized Action Items with Ownership and Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
                <Briefcase className="w-4 h-4 text-[#0096AF]" />
                <span>Actionable Improvement Recommendations</span>
              </h4>
              <span className="text-xs text-slate-500 font-medium">Accountable Roles & Targets</span>
            </div>

            <div className="divide-y divide-slate-100">
              {actionItems.map((item: any, i: number) => (
                <div key={i} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-[#0096AF] text-white flex items-center justify-center text-[10px] font-bold">
                        {i + 1}
                      </span>
                      <span className="font-bold text-slate-900">{item.action}</span>
                    </div>
                    {item.rationale && (
                      <p className="text-slate-600 text-xs pl-7 leading-relaxed">{item.rationale}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 pl-7 sm:pl-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">Owner</span>
                      <span className="font-semibold text-slate-800">{item.suggestedOwner || `${department} Lead`}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">Timeline</span>
                      <span className="font-semibold text-[#0096AF]">{item.targetTimeline || '30 Days'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Measurable Quality Indicators (KPIs) */}
          {kpis.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center space-x-1.5">
                <TrendingUp className="w-4 h-4 text-[#0096AF]" />
                <span>Target Quality Indicators (KPIs)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                {kpis.map((kpi: string, i: number) => (
                  <div key={i} className="flex items-center space-x-2 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-[#0096AF] shrink-0" />
                    <span>{kpi}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Audit Conclusion Box */}
        <div className="p-5 bg-teal-50/50 rounded-xl border border-teal-200">
          <h4 className="text-xs font-bold text-[#0096AF] uppercase tracking-wide mb-1.5">
            Final Audit Conclusion & Leadership Summary
          </h4>
          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
            {conclusion}
          </p>
          <div className="mt-3 pt-3 border-t border-teal-200/60 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
            <span>Priority Risk Management • Total Quality Management Standard Review</span>
            <span>All recommendations advisory pending management review</span>
          </div>
        </div>
      </div>
    </div>
  );
};
