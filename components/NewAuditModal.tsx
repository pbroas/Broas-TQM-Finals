'use client';

import React, { useState, useEffect } from 'react';
import { X, Sparkles, Building2, BookOpen, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { DEPARTMENTS } from './ProfileModal';
import { PRMStandard } from '@/lib/default-standards';

interface NewAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
  standards: PRMStandard[];
  onStartAudit: (params: {
    department: string;
    processName: string;
    standard: PRMStandard | null;
  }) => void;
}

export const DEPARTMENT_PROCESSES: Record<string, string[]> = {
  'Personal Lines': [
    'Policy Renewal Preparation & Premium Variance Review',
    'Client Renewal Outreach (60-45-30 Day Sequence)',
    'Auto & Homeowners Policy Remarketing Submission',
    'Endorsement & Policy Change Request Handling',
    'Billing Inquiry & Non-Pay Cancellation Follow-up',
  ],
  'Commercial Lines': [
    'Certificate of Insurance (COI) Intake & ACORD 25 Issuance',
    'Commercial Renewal Marketing Submissions (90-Day Pipeline)',
    'Carrier Additional Insured / Waiver of Subrogation Verification',
    'Policy Audit Exposure Reconciliation',
    'Commercial Lines Mid-Term Account Servicing & Handoff',
  ],
  'Risk Advisors and Sales': [
    'New Lead Intake Velocity & 15-Minute AgencyZoom Triage',
    '12-Point Commercial Exposure Assessment & Risk Profile',
    'Comparative Quote Preparation & Carrier Placement',
    'Risk Advisory Proposal Presentation & Client Delivery',
    'Pipeline Stage Velocity & Lost Business Debrief Process',
  ],
  'Reception and Support Operations': [
    'RingCentral Incoming Call Triage & Departmental Routing',
    'Caller Intent Warm-Transfer Protocol & Account Handoff',
    'Emergency & Distressed Policyholder Escalation Standard',
    'Voicemail Turnaround & AMS Service Ticket Distribution',
    'Repeat Inquiry Reduction & First-Contact Resolution',
  ],
  'Administration and Operations': [
    'IVANS Daily Policy Download Exception Clearing in AMS360',
    'Cross-System Reconciliation (AMS360 vs AgencyZoom vs Carrier Direct)',
    'Agency-Wide Unassigned & Overdue Task Resolution Audit',
    'Client Account De-duplication & Record Consolidation',
    'Staff Onboarding & Role-Based System Credentialing',
  ],
};

export const NewAuditModal: React.FC<NewAuditModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  standards,
  onStartAudit,
}) => {
  const initialDept = userProfile?.department || DEPARTMENTS[0];
  const [selectedDept, setSelectedDept] = useState(initialDept);
  const [prevDept, setPrevDept] = useState(initialDept);
  const defaultList = DEPARTMENT_PROCESSES[selectedDept] || [];
  const [selectedProcess, setSelectedProcess] = useState(defaultList[0] || '');
  const [isCustomProcess, setIsCustomProcess] = useState(false);
  const [customProcessName, setCustomProcessName] = useState('');
  const defaultStd = standards.find((s) => s.department === selectedDept)?.id || '';
  const [selectedStandardId, setSelectedStandardId] = useState<string>(defaultStd);

  if (selectedDept !== prevDept) {
    setPrevDept(selectedDept);
    const newDefaults = DEPARTMENT_PROCESSES[selectedDept] || [];
    if (!isCustomProcess) {
      setSelectedProcess(newDefaults[0] || '');
    }
    const matchingStd = standards.find((s) => s.department === selectedDept);
    setSelectedStandardId(matchingStd ? matchingStd.id : '');
  }

  if (!isOpen) return null;

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const finalProcess = isCustomProcess ? customProcessName.trim() : selectedProcess;
    if (!finalProcess) return;

    const linkedStandard = standards.find((s) => s.id === selectedStandardId) || null;

    onStartAudit({
      department: selectedDept,
      processName: finalProcess,
      standard: linkedStandard,
    });
  };

  const processOptions = DEPARTMENT_PROCESSES[selectedDept] || [];
  const deptStandards = standards.filter((s) => s.department === selectedDept && s.status === 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#0096AF]/10 text-[#0096AF] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Launch New Quality Audit</h3>
              <p className="text-xs text-slate-500">TQM Process Review & Continuous Improvement</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleStart} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Department</label>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setIsCustomProcess(false);
              }}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF] focus:border-[#0096AF] bg-white"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Workflow / Process Under Evaluation</label>
              <button
                type="button"
                onClick={() => setIsCustomProcess(!isCustomProcess)}
                className="text-[11px] text-[#0096AF] font-semibold hover:underline"
              >
                {isCustomProcess ? 'Choose from PRM Workflows' : '+ Custom Process Name'}
              </button>
            </div>

            {isCustomProcess ? (
              <input
                type="text"
                value={customProcessName}
                onChange={(e) => setCustomProcessName(e.target.value)}
                placeholder="e.g. High-Net-Worth Umbrella Remarketing Procedure"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF] focus:border-[#0096AF]"
              />
            ) : (
              <select
                value={selectedProcess}
                onChange={(e) => setSelectedProcess(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF] focus:border-[#0096AF] bg-white"
              >
                {processOptions.map((proc) => (
                  <option key={proc} value={proc}>
                    {proc}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Linked PRM Quality Standard (SOP)
            </label>
            <select
              value={selectedStandardId}
              onChange={(e) => setSelectedStandardId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF] focus:border-[#0096AF] bg-white"
            >
              <option value="">No formal benchmark standard (Classify as Not Verified)</option>
              {deptStandards.map((std) => (
                <option key={std.id} value={std.id}>
                  {std.code} - {std.title} (v{std.version})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Gemini will compare employee steps against the approved SOP requirements and quality indicators.
            </p>
          </div>

          <div className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-lg flex items-start space-x-2 text-xs text-slate-700">
            <ShieldCheck className="w-4 h-4 text-[#0096AF] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">Total Quality Management Pledge:</span>
              <p className="text-[11px] text-slate-600 mt-0.5">
                This audit session is dedicated to continuous process improvement and removing operational friction. It is never used for automated disciplinary decisions.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0096AF] hover:bg-[#008197] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <span>Begin Quality Audit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
