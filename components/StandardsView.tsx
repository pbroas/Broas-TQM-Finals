'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  Building2,
  CheckCircle2,
  Clock,
  Edit3,
  Archive,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  X,
  AlertCircle,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { PRMStandard, INITIAL_PRM_STANDARDS } from '@/lib/default-standards';
import { DEPARTMENTS } from './ProfileModal';

interface StandardsViewProps {
  standards: PRMStandard[];
  isSuperAdmin: boolean;
  userEmail: string;
  onRefresh: () => void;
}

export const StandardsView: React.FC<StandardsViewProps> = ({
  standards,
  isSuperAdmin,
  userEmail,
  onRefresh,
}) => {
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStandard, setActiveStandard] = useState<PRMStandard | null>(null);
  const [editingStandard, setEditingStandard] = useState<PRMStandard | null>(null);
  const [isNewStandard, setIsNewStandard] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const filteredStandards = standards.filter((s) => {
    const matchesDept = selectedDept === 'all' || s.department === selectedDept;
    const matchesSearch =
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.requirements.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      for (const std of INITIAL_PRM_STANDARDS) {
        await setDoc(doc(db, 'standards', std.id), {
          ...std,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      onRefresh();
    } catch (err) {
      console.error('Error seeding standards:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'standards');
      } catch (e) {
        // logged
      }
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveStandard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStandard) return;

    if (!editingStandard.code || !editingStandard.title || !editingStandard.requirements) {
      setSaveError('Please complete all required fields.');
      return;
    }

    setSaveError(null);
    try {
      const stdId = editingStandard.id || editingStandard.code.replace(/[^a-zA-Z0-9_-]/g, '-');
      const payload = {
        ...editingStandard,
        id: stdId,
        authorEmail: userEmail,
        updatedAt: new Date().toISOString(),
        createdAt: editingStandard.createdAt || new Date().toISOString(),
      };

      await setDoc(doc(db, 'standards', stdId), payload);
      setEditingStandard(null);
      setIsNewStandard(false);
      onRefresh();
    } catch (err) {
      console.error('Error saving standard:', err);
      setSaveError('Failed to persist standard to Firestore.');
      try {
        handleFirestoreError(err, OperationType.WRITE, 'standards');
      } catch (e) {
        // logged
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#0096AF] uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>PRM Operational Knowledge Base</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Company Quality Standards & SOPs</h2>
          <p className="text-xs text-slate-500">
            Authoritative benchmark procedures for Personal Lines, Commercial Lines, Risk Advisors, and Support Operations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isSuperAdmin && (
            <>
              <button
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors flex items-center space-x-1.5"
                title="Populate/Reset 5 PRM Department Standard Operating Procedures"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
                <span>{seeding ? 'Seeding...' : 'Load Standard SOPs'}</span>
              </button>

              <button
                onClick={() => {
                  setIsNewStandard(true);
                  setEditingStandard({
                    id: '',
                    code: 'PRM-SOP-' + Date.now().toString().slice(-4),
                    title: '',
                    department: DEPARTMENTS[0],
                    version: '1.0',
                    effectiveDate: new Date().toISOString().split('T')[0],
                    scope: 'All applicable staff at PRM.',
                    requirements: '',
                    qualityIndicators: '',
                    status: 'active',
                    authorEmail: userEmail,
                  });
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#0096AF] hover:bg-[#008197] rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Standard</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedDept('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
              selectedDept === 'all'
                ? 'bg-[#0096AF] text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Departments
          </button>
          {DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                selectedDept === dept
                  ? 'bg-[#0096AF] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search standards & codes..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
          />
        </div>
      </div>

      {/* Standards Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStandards.map((std) => (
          <div
            key={std.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-[#0096AF]/50 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-[#0096AF] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {std.code}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">v{std.version}</span>
              </div>

              <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1">{std.title}</h3>
              <p className="text-xs text-slate-500 font-medium mb-3">{std.department}</p>

              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                {std.requirements}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setActiveStandard(std)}
                className="text-xs font-semibold text-[#0096AF] hover:underline"
              >
                View Full Standard
              </button>

              {isSuperAdmin && (
                <button
                  onClick={() => {
                    setIsNewStandard(false);
                    setEditingStandard(std);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                  title="Edit Standard"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredStandards.length === 0 && (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No standards found matching your criteria.</p>
          <p className="text-xs text-slate-500 mt-1">
            {isSuperAdmin
              ? 'Click "Load Standard SOPs" above to populate all 5 department operating procedures.'
              : 'Contact an authorized Super Administrator to upload the operating procedure.'}
          </p>
        </div>
      )}

      {/* Standard Detail Modal */}
      {activeStandard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full border border-slate-200 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-[#0096AF] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {activeStandard.code}
                  </span>
                  <span className="text-xs text-slate-500">v{activeStandard.version}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-base mt-1">{activeStandard.title}</h3>
                <p className="text-xs text-slate-500">{activeStandard.department}</p>
              </div>
              <button
                onClick={() => setActiveStandard(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">Scope</h4>
                <p className="bg-slate-50 p-3 rounded-lg border border-slate-200">{activeStandard.scope}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">
                  Documented SOP Requirements
                </h4>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                  {activeStandard.requirements}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">
                  Measurable Quality Indicators (KPIs)
                </h4>
                <p className="bg-slate-50 p-3 rounded-lg border border-slate-200">{activeStandard.qualityIndicators}</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActiveStandard(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Standard Modal */}
      {editingStandard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {isNewStandard ? 'Add Company Standard' : 'Edit Standard: ' + editingStandard.code}
              </h3>
              <button
                onClick={() => setEditingStandard(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStandard} className="p-6 overflow-y-auto space-y-4">
              {saveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Code</label>
                  <input
                    type="text"
                    value={editingStandard.code}
                    onChange={(e) => setEditingStandard({ ...editingStandard, code: e.target.value })}
                    required
                    placeholder="e.g. PRM-SOP-PL-02"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Version</label>
                  <input
                    type="text"
                    value={editingStandard.version}
                    onChange={(e) => setEditingStandard({ ...editingStandard, version: e.target.value })}
                    required
                    placeholder="e.g. 1.0"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Title</label>
                <input
                  type="text"
                  value={editingStandard.title}
                  onChange={(e) => setEditingStandard({ ...editingStandard, title: e.target.value })}
                  required
                  placeholder="e.g. Personal Lines Remarketing Protocol"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={editingStandard.department}
                  onChange={(e) => setEditingStandard({ ...editingStandard, department: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF] bg-white"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scope</label>
                <input
                  type="text"
                  value={editingStandard.scope}
                  onChange={(e) => setEditingStandard({ ...editingStandard, scope: e.target.value })}
                  placeholder="e.g. Commercial Lines CSRs across all branches."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Procedure Requirements & Rules
                </label>
                <textarea
                  rows={6}
                  value={editingStandard.requirements}
                  onChange={(e) => setEditingStandard({ ...editingStandard, requirements: e.target.value })}
                  required
                  placeholder="Step 1: ...&#10;Step 2: ...&#10;Step 3: ..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Measurable Quality Indicators (KPIs)
                </label>
                <input
                  type="text"
                  value={editingStandard.qualityIndicators}
                  onChange={(e) => setEditingStandard({ ...editingStandard, qualityIndicators: e.target.value })}
                  placeholder="e.g. Turnaround < 4 hours, rework rate < 2%."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingStandard(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0096AF] hover:bg-[#008197] text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  Save Standard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
