'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  FileCheck2,
  AlertTriangle,
  TrendingUp,
  Target,
  RefreshCw,
  Clock,
  Filter,
  CheckCircle2,
  Check,
  ChevronRight,
  ShieldCheck,
  Building2,
  User,
  Plus,
  Edit2,
  Trash2,
  Eye,
  X,
  UserCheck,
  UserPlus,
  UserMinus,
  ShieldAlert,
  History,
  Key,
  Mail,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { DESIGNATED_SUPER_ADMIN_EMAIL } from '@/lib/security';
import { DEPARTMENTS } from './ProfileModal';
import { CLASSIFICATION_CONFIG, PRIORITY_CONFIG } from './AuditReportView';

interface AdminDashboardProps {
  userEmail: string;
  onViewAudit: (audit: any) => void;
  onRefreshAll: () => void;
  onAdminRoleChanged?: () => void;
}

export const ACTION_STATUSES = [
  { id: 'identified', label: 'Identified', color: 'bg-slate-100 text-slate-800' },
  { id: 'under_review', label: 'Under Review', color: 'bg-blue-100 text-blue-800' },
  { id: 'planned', label: 'Planned', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  { id: 'pending_verification', label: 'Pending Verification', color: 'bg-purple-100 text-purple-800' },
  { id: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'closed_without_action', label: 'Closed w/o Action', color: 'bg-rose-100 text-rose-800' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  userEmail,
  onViewAudit,
  onRefreshAll,
  onAdminRoleChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'audits' | 'actions' | 'admins'>('overview');
  const [actions, setActions] = useState<any[]>([]);
  const [allAudits, setAllAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [editingAction, setEditingAction] = useState<any | null>(null);
  const [savingAction, setSavingAction] = useState(false);

  // Admin Management State
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [targetAdminEmail, setTargetAdminEmail] = useState('');
  const [targetAdminName, setTargetAdminName] = useState('');
  const [targetAdminNotes, setTargetAdminNotes] = useState('');
  const [submittingAdminAction, setSubmittingAdminAction] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'grant' | 'revoke';
    email: string;
    displayName?: string;
    notes?: string;
  } | null>(null);

  const fetchAdminData = React.useCallback(async () => {
    setLoading(true);
    try {
      const actionsSnap = await getDocs(collection(db, 'actions'));
      const actionsList: any[] = [];
      actionsSnap.forEach((d) => actionsList.push({ id: d.id, ...d.data() }));
      setActions(actionsList);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    getDocs(collection(db, 'actions'))
      .then((actionsSnap) => {
        if (!isSubscribed) return;
        const actionsList: any[] = [];
        actionsSnap.forEach((d) => actionsList.push({ id: d.id, ...d.data() }));
        setActions(actionsList);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load admin data:', err);
        if (isSubscribed) setLoading(false);
      });

    // Pre-populate admin list in background
    auth.currentUser?.getIdToken().then((token) => {
      if (!token || !isSubscribed) return;
      fetch('/api/admin/admins', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!isSubscribed) return;
          if (data.admins) setAdminsList(data.admins);
          if (data.logs) setAdminAuditLogs(data.logs);
        })
        .catch(() => {});
    });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const handleUpdateActionStatus = async (actionId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'actions', actionId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      setActions(actions.map((a) => (a.id === actionId ? { ...a, status: newStatus } : a)));
    } catch (err) {
      console.error('Failed to update action status:', err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `actions/${actionId}`);
      } catch (e) {}
    }
  };

  const handleSaveActionDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAction) return;

    setSavingAction(true);
    try {
      await updateDoc(doc(db, 'actions', editingAction.id), {
        problemStatement: editingAction.problemStatement,
        correctiveAction: editingAction.correctiveAction,
        assignedOwner: editingAction.assignedOwner,
        targetDate: editingAction.targetDate,
        status: editingAction.status,
        pdcaPhase: editingAction.pdcaPhase,
        verificationResult: editingAction.verificationResult || '',
        notes: editingAction.notes || '',
        updatedAt: new Date().toISOString(),
      });

      setActions(actions.map((a) => (a.id === editingAction.id ? editingAction : a)));
      setEditingAction(null);
    } catch (err) {
      console.error('Failed to save action details:', err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `actions/${editingAction.id}`);
      } catch (e) {}
    } finally {
      setSavingAction(false);
    }
  };

  const fetchAdminsAndLogs = React.useCallback(async () => {
    setLoadingAdmins(true);
    try {
      const rootEmail = DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase();
      const map = new Map<string, any>();

      // Always include designated root administrator
      map.set(rootEmail, {
        id: 'admin_root',
        email: rootEmail,
        displayName: 'Pauline Ingrid (Designated Root)',
        role: 'super_admin',
        status: 'active',
        grantedBy: 'System Bootstrap',
        grantedAt: '2026-10-31T00:00:00.000Z',
        isDesignatedRoot: true,
      });

      // 1. Fetch from Firestore /admins collection using authenticated client SDK
      try {
        const adminsSnap = await getDocs(collection(db, 'admins'));
        adminsSnap.forEach((d) => {
          const data = d.data();
          if (data && data.email) {
            const em = data.email.toLowerCase();
            map.set(em, {
              id: d.id,
              email: em,
              displayName: data.displayName || em.split('@')[0],
              role: 'super_admin',
              status: data.status === 'revoked' ? 'revoked' : 'active',
              grantedBy: data.grantedBy || 'Super Admin',
              grantedAt: data.grantedAt || new Date().toISOString(),
              revokedBy: data.revokedBy,
              revokedAt: data.revokedAt,
              isDesignatedRoot: em === rootEmail,
            });
          }
        });
      } catch (firestoreErr) {
        console.warn('Direct admins fetch note:', firestoreErr);
      }

      setAdminsList(Array.from(map.values()));

      // 2. Fetch from Firestore /admin_audit_logs collection
      try {
        const logsSnap = await getDocs(collection(db, 'admin_audit_logs'));
        const list: any[] = [];
        logsSnap.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        setAdminAuditLogs(list);
      } catch (logsErr) {
        console.warn('Direct admin audit logs fetch note:', logsErr);
      }
    } catch (err: any) {
      console.warn('Failed to fetch admin list:', err);
    } finally {
      setLoadingAdmins(false);
    }
  }, []);

  const handleInitiateGrant = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!targetAdminEmail.trim() || !targetAdminEmail.includes('@')) {
      setAdminFeedback({ type: 'error', message: 'Please enter a valid Google Account email address.' });
      return;
    }
    setConfirmDialog({
      type: 'grant',
      email: targetAdminEmail.trim().toLowerCase(),
      displayName: targetAdminName.trim() || targetAdminEmail.split('@')[0],
      notes: targetAdminNotes.trim(),
    });
  };

  const handleConfirmGrant = async () => {
    if (!confirmDialog || confirmDialog.type !== 'grant') return;
    setSubmittingAdminAction(true);
    setModalError(null);
    setAdminFeedback(null);
    try {
      const email = confirmDialog.email.trim().toLowerCase();
      // Ensure document ID matches isValidId: only alphanumeric and underscore
      const sanitizedDocId = `admin_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const now = new Date().toISOString();
      const currentActor = userEmail || auth.currentUser?.email || 'Super Admin';

      const newAdminRecord = {
        id: sanitizedDocId,
        email: email,
        displayName: confirmDialog.displayName || email.split('@')[0],
        role: 'super_admin',
        status: 'active',
        grantedBy: currentActor,
        grantedAt: now,
        notes: confirmDialog.notes || 'Super Administrator role granted.',
        isDesignatedRoot: email === DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase(),
      };

      // 1. Direct write to /admins in Firestore using authenticated client SDK
      await setDoc(doc(db, 'admins', sanitizedDocId), newAdminRecord, { merge: true });

      // 2. Record immutable audit log in /admin_audit_logs
      const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const logEntry = {
        id: logId,
        action: 'grant',
        targetEmail: email,
        performedBy: currentActor,
        timestamp: now,
        notes: confirmDialog.notes || 'Super Administrator role granted.',
      };
      await setDoc(doc(db, 'admin_audit_logs', logId), logEntry);

      // 3. Sync claims via API in background (non-blocking)
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          fetch('/api/admin/admins', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email: email,
              displayName: confirmDialog.displayName,
              notes: confirmDialog.notes,
            }),
          }).catch((e) => console.info('Background claims sync info:', e));
        }
      } catch (tokenErr) {
        // Non-blocking
      }

      setAdminFeedback({
        type: 'success',
        message: `Successfully granted Super Admin privileges to ${email}.`,
      });
      setTargetAdminEmail('');
      setTargetAdminName('');
      setTargetAdminNotes('');
      setConfirmDialog(null);
      await fetchAdminsAndLogs();
      if (onAdminRoleChanged) onAdminRoleChanged();
    } catch (err: any) {
      console.error('Error granting admin access:', err);
      const errMsg = err?.message || 'Error granting admin access.';
      setModalError(errMsg);
      setAdminFeedback({ type: 'error', message: errMsg });
      try {
        handleFirestoreError(err, OperationType.WRITE, 'admins');
      } catch (e) {}
    } finally {
      setSubmittingAdminAction(false);
    }
  };

  const handleInitiateRevoke = (admin: any) => {
    setModalError(null);
    if (admin.isDesignatedRoot) {
      setAdminFeedback({
        type: 'error',
        message: 'The primary designated root Super Administrator (paulineingrid123@gmail.com) cannot be revoked.',
      });
      return;
    }
    const activeCount = adminsList.filter((a) => a.status !== 'revoked').length;
    if (activeCount <= 1) {
      setAdminFeedback({
        type: 'error',
        message: 'Cannot revoke the last active Super Administrator. At least one administrator must remain.',
      });
      return;
    }
    setConfirmDialog({
      type: 'revoke',
      email: admin.email,
      displayName: admin.displayName,
    });
  };

  const handleConfirmRevoke = async () => {
    if (!confirmDialog || confirmDialog.type !== 'revoke') return;
    setSubmittingAdminAction(true);
    setModalError(null);
    setAdminFeedback(null);
    try {
      const email = confirmDialog.email.trim().toLowerCase();
      const sanitizedDocId = `admin_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const now = new Date().toISOString();
      const currentActor = userEmail || auth.currentUser?.email || 'Super Admin';

      // 1. Mark status as revoked in Firestore /admins
      await setDoc(
        doc(db, 'admins', sanitizedDocId),
        {
          status: 'revoked',
          revokedBy: currentActor,
          revokedAt: now,
        },
        { merge: true }
      );

      // 2. Record immutable audit log in /admin_audit_logs
      const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const logEntry = {
        id: logId,
        action: 'revoke',
        targetEmail: email,
        performedBy: currentActor,
        timestamp: now,
        notes: `Super Administrator privileges revoked by ${currentActor}`,
      };
      await setDoc(doc(db, 'admin_audit_logs', logId), logEntry);

      // 3. Revoke claims via API in background (non-blocking)
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          fetch(`/api/admin/admins?email=${encodeURIComponent(email)}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }).catch((e) => console.info('Background claims revoke info:', e));
        }
      } catch (tokenErr) {}

      setAdminFeedback({
        type: 'success',
        message: `Successfully revoked Super Admin privileges for ${email}.`,
      });
      setConfirmDialog(null);
      await fetchAdminsAndLogs();
      if (onAdminRoleChanged) onAdminRoleChanged();
    } catch (err: any) {
      console.error('Error revoking admin access:', err);
      const errMsg = err?.message || 'Error revoking admin access.';
      setModalError(errMsg);
      setAdminFeedback({ type: 'error', message: errMsg });
      try {
        handleFirestoreError(err, OperationType.UPDATE, 'admins');
      } catch (e) {}
    } finally {
      setSubmittingAdminAction(false);
    }
  };

  // Compute metrics from actual actions & audits
  const totalActions = actions.length;
  const inProgressActions = actions.filter((a) => a.status === 'in_progress' || a.status === 'planned').length;
  const completedActions = actions.filter((a) => a.status === 'completed').length;
  const highPriorityActions = actions.filter((a) => a.priority === 'high').length;

  const departmentCounts: Record<string, number> = {};
  for (const dept of DEPARTMENTS) {
    departmentCounts[dept] = actions.filter((a) => a.department === dept).length;
  }

  const filteredActions = actions.filter((a) => {
    const matchesDept = selectedDeptFilter === 'all' || a.department === selectedDeptFilter;
    const matchesStatus = selectedStatusFilter === 'all' || a.status === selectedStatusFilter;
    return matchesDept && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0096AF]">
            <ShieldCheck className="w-4 h-4" />
            <span>Super Administrator Control Room</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            PRM Quality Intelligence & PDCA Oversight
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Agency-wide process quality analytics, recurring bottlenecks, and continuous improvement tracking.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-800 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>Super Admin: {userEmail}</span>
          </div>

          <button
            onClick={fetchAdminData}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors"
            title="Refresh Intelligence Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === 'overview'
              ? 'bg-[#0096AF] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Quality KPIs & Departments</span>
        </button>

        <button
          onClick={() => setActiveTab('actions')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === 'actions'
              ? 'bg-[#0096AF] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>PDCA Action Tracker ({actions.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('admins');
            fetchAdminsAndLogs();
          }}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === 'admins'
              ? 'bg-[#0096AF] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Admin Management ({adminsList.filter((a) => a.status !== 'revoked').length || 1})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & KPIS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Total Improvement Actions
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{totalActions}</span>
              <span className="text-[11px] text-teal-600 font-semibold mt-1 block">Active across agency</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                In Active PDCA Cycle
              </span>
              <span className="text-2xl font-black text-[#0096AF] mt-1 block">{inProgressActions}</span>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Plan & Do phases</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Completed & Verified
              </span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">{completedActions}</span>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Standardized workflows</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                High Priority Focus
              </span>
              <span className="text-2xl font-black text-[#DC582A] mt-1 block">{highPriorityActions}</span>
              <span className="text-[11px] text-rose-600 font-semibold mt-1 block">Requires executive review</span>
            </div>
          </div>

          {/* Department Breakdown Bar Grid */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#0096AF]" />
              <span>Departmental Process Quality Distribution</span>
            </h3>

            <div className="space-y-3">
              {DEPARTMENTS.map((dept) => {
                const count = departmentCounts[dept] || 0;
                const pct = totalActions > 0 ? Math.round((count / totalActions) * 100) : 0;
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{dept}</span>
                      <span className="text-slate-500 font-mono">
                        {count} items ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0096AF] rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Responsible AI Disclaimer Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
            <span className="font-bold text-slate-900 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0096AF]" />
              <span>Responsible AI Quality Governance</span>
            </span>
            <p className="leading-relaxed">
              All findings and root causes generated by Gemini represent advisory analytical hypotheses derived from employee interview inputs. Management review and authorization by designated PRM leadership is required prior to policy standardization.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: PDCA ACTION TRACKER */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
              >
                <option value="all">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
              >
                <option value="all">All Statuses</option>
                {ACTION_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredActions.length} of {actions.length} action items
            </span>
          </div>

          {/* Action Cards List */}
          <div className="space-y-3">
            {filteredActions.map((action) => {
              const statusMeta =
                ACTION_STATUSES.find((s) => s.id === action.status) || ACTION_STATUSES[0];
              const priorityMeta =
                PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG.medium;

              return (
                <div
                  key={action.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-[#0096AF]/50 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-[#0096AF] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {action.id}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{action.department}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-medium text-slate-600 truncate max-w-xs">
                        {action.processName}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${priorityMeta.bg} ${priorityMeta.text}`}>
                        {priorityMeta.label}
                      </span>
                      <button
                        onClick={() => setEditingAction(action)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                        title="Edit Action"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-700 block mb-1">Problem Statement:</span>
                      <p className="text-slate-600 leading-relaxed">{action.problemStatement}</p>
                    </div>

                    <div className="p-3 bg-teal-50/40 rounded-lg border border-teal-100">
                      <span className="font-bold text-[#0096AF] block mb-1">Corrective Action Plan:</span>
                      <p className="text-slate-700 leading-relaxed">{action.correctiveAction}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500 gap-2">
                    <div className="flex items-center space-x-3">
                      <span>
                        <strong className="text-slate-700">Owner:</strong> {action.assignedOwner || 'Unassigned'}
                      </span>
                      <span>
                        <strong className="text-slate-700">Target Date:</strong> {action.targetDate || 'Not set'}
                      </span>
                      <span>
                        <strong className="text-slate-700">PDCA Phase:</strong>{' '}
                        <span className="uppercase font-mono font-bold text-[#0096AF]">{action.pdcaPhase || 'plan'}</span>
                      </span>
                    </div>

                    {/* Quick status stepper button */}
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Change Status:</span>
                      <select
                        value={action.status}
                        onChange={(e) => handleUpdateActionStatus(action.id, e.target.value)}
                        className="text-[11px] px-2 py-0.5 bg-white border border-slate-300 rounded font-medium focus:ring-1 focus:ring-[#0096AF]"
                      >
                        {ACTION_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredActions.length === 0 && (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
                <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No improvement actions recorded yet.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Actions are generated directly from completed employee quality audit reports.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN MANAGEMENT */}
      {activeTab === 'admins' && (
        <div className="space-y-6">
          {/* Feedback Toast */}
          {adminFeedback && (
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                adminFeedback.type === 'success'
                  ? 'bg-teal-50 border-teal-200 text-teal-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                {adminFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#0096AF] shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span className="text-xs sm:text-sm font-semibold">{adminFeedback.message}</span>
              </div>
              <button
                onClick={() => setAdminFeedback(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Admin KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Active Super Admins
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {adminsList.filter((a) => a.status !== 'revoked').length || 1}
              </span>
              <span className="text-[11px] text-teal-600 font-semibold mt-1 block">Full agency oversight</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Designated Root
              </span>
              <span className="text-xs font-black text-amber-800 truncate mt-2 block" title="paulineingrid123@gmail.com">
                paulineingrid123@gmail.com
              </span>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Immutable Root Authority</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Security Audit Events
              </span>
              <span className="text-2xl font-black text-[#0096AF] mt-1 block">{adminAuditLogs.length}</span>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Role change audit trail</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Authorization Guard
              </span>
              <span className="text-xs font-black text-slate-900 mt-2 block">Zero-Trust ABAC</span>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Firebase Admin Verified</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Grant Super Admin Form */}
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
                <UserPlus className="w-4 h-4 text-[#0096AF]" />
                <span>Grant Super Administrator</span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Elevate a colleague to Super Administrator. Granted accounts gain full access to consolidated departmental audits, approved PRM standards, and PDCA actions.
              </p>

              <form onSubmit={handleInitiateGrant} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Account Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={targetAdminEmail}
                      onChange={(e) => setTargetAdminEmail(e.target.value)}
                      placeholder="colleague@prm.com or name@gmail.com"
                      className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Supports accounts inside or outside PRM Workspace.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name / Role (Optional)
                  </label>
                  <input
                    type="text"
                    value={targetAdminName}
                    onChange={(e) => setTargetAdminName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins (Commercial Lines Lead)"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Authorization Justification & Notes
                  </label>
                  <textarea
                    rows={2}
                    value={targetAdminNotes}
                    onChange={(e) => setTargetAdminNotes(e.target.value)}
                    placeholder="e.g. Executive quality review board member"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                  />
                </div>

                <div className="p-3 bg-teal-50/70 border border-teal-200/60 rounded-lg text-[11px] text-teal-900 space-y-1">
                  <div className="font-bold flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0096AF]" />
                    <span>Security Verification Note</span>
                  </div>
                  <p className="text-teal-800">
                    Administrative access updates Firebase custom claims and registers the user in the hardened Firestore <code className="bg-teal-100 px-1 py-0.2 rounded font-mono">/admins</code> collection.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submittingAdminAction}
                  className="w-full py-2.5 px-4 bg-[#0096AF] hover:bg-[#008197] text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Grant Super Admin Access</span>
                </button>
              </form>
            </div>

            {/* Right Column: Active Super Administrators List */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-[#0096AF]" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Current Super Administrators ({adminsList.filter((a) => a.status !== 'revoked').length || 1})
                  </h3>
                </div>
                <button
                  onClick={fetchAdminsAndLogs}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAdmins ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {adminsList.map((admin, idx) => {
                  const isRevoked = admin.status === 'revoked';
                  return (
                    <div
                      key={admin.id || admin.email || idx}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors ${
                        isRevoked ? 'opacity-50 bg-slate-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-[#0096AF]/30">
                          {admin.displayName ? admin.displayName.charAt(0).toUpperCase() : admin.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {admin.displayName || admin.email.split('@')[0]}
                            </span>
                            {admin.isDesignatedRoot ? (
                              <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                                ROOT SUPER ADMIN
                              </span>
                            ) : isRevoked ? (
                              <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-300">
                                REVOKED
                              </span>
                            ) : (
                              <span className="text-[10px] bg-teal-100 text-teal-900 font-bold px-2 py-0.5 rounded-full border border-teal-300">
                                SUPER ADMIN
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{admin.email}</p>
                          <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-3">
                            <span>
                              Granted by: <strong className="text-slate-600 font-medium">{admin.grantedBy}</strong>
                            </span>
                            <span>•</span>
                            <span>{admin.grantedAt ? new Date(admin.grantedAt).toLocaleDateString() : 'Active'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {admin.isDesignatedRoot ? (
                          <span
                            className="text-[11px] text-slate-400 italic px-2 py-1 bg-slate-100 rounded"
                            title="The primary designated root administrator cannot be revoked."
                          >
                            Protected Root
                          </span>
                        ) : isRevoked ? (
                          <span className="text-[11px] text-rose-500 italic px-2 py-1 bg-rose-50 rounded">
                            Access Inactive
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInitiateRevoke(admin)}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center space-x-1"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>Revoke Access</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {adminsList.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Loading administrator directory...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Administrator Role Change Audit Log Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-[#0096AF]" />
                <h3 className="font-bold text-slate-900 text-sm">Administrator Role Audit Log</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Immutable security audit records ({adminAuditLogs.length})
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="p-3">Action</th>
                    <th className="p-3">Target Google Account</th>
                    <th className="p-3">Performed By</th>
                    <th className="p-3">Notes & Reason</th>
                    <th className="p-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {adminAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold">
                        {log.action === 'grant' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px]">
                            <UserPlus className="w-3 h-3 text-[#0096AF]" />
                            <span>GRANT</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px]">
                            <UserMinus className="w-3 h-3 text-rose-600" />
                            <span>REVOKE</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-medium text-slate-900">{log.targetEmail}</td>
                      <td className="p-3 text-slate-600">{log.performedBy}</td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">{log.notes || '—'}</td>
                      <td className="p-3 text-slate-400 text-right font-mono text-[11px]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}

                  {adminAuditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 text-xs">
                        No administrator role changes recorded yet. Initial root administrator established at system bootstrap.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Action Modal */}
      {editingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Update PDCA Improvement Action</h3>
              <button
                onClick={() => setEditingAction(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveActionDetails} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Problem Statement</label>
                <textarea
                  rows={2}
                  value={editingAction.problemStatement}
                  onChange={(e) => setEditingAction({ ...editingAction, problemStatement: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Corrective Action Plan</label>
                <textarea
                  rows={3}
                  value={editingAction.correctiveAction}
                  onChange={(e) => setEditingAction({ ...editingAction, correctiveAction: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Owner</label>
                  <input
                    type="text"
                    value={editingAction.assignedOwner}
                    onChange={(e) => setEditingAction({ ...editingAction, assignedOwner: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Completion Date</label>
                  <input
                    type="date"
                    value={editingAction.targetDate}
                    onChange={(e) => setEditingAction({ ...editingAction, targetDate: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PDCA Phase</label>
                  <select
                    value={editingAction.pdcaPhase}
                    onChange={(e) => setEditingAction({ ...editingAction, pdcaPhase: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="plan">Plan</option>
                    <option value="do">Do</option>
                    <option value="check">Check</option>
                    <option value="act">Act</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingAction.status}
                    onChange={(e) => setEditingAction({ ...editingAction, status: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {ACTION_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Verification Result & Notes</label>
                <input
                  type="text"
                  value={editingAction.verificationResult || ''}
                  onChange={(e) => setEditingAction({ ...editingAction, verificationResult: e.target.value })}
                  placeholder="e.g. Turnaround measured at 2.4 hours across 50 renewals."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingAction(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="px-4 py-2 bg-[#0096AF] hover:bg-[#008197] text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  {savingAction ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Action Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#DC582A]" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {confirmDialog.type === 'grant'
                    ? 'Confirm Administrative Elevation'
                    : 'Confirm Administrator Revocation'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setConfirmDialog(null);
                  setModalError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {confirmDialog.type === 'grant' ? (
                  <>
                    You are granting full <strong>Super Administrator</strong> privileges to{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">
                      {confirmDialog.email}
                    </code>
                    . They will have authorized access to view all employee quality audit transcripts, modify PRM standards, and manage administrative settings.
                  </>
                ) : (
                  <>
                    Are you sure you want to revoke Super Administrator privileges for{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">
                      {confirmDialog.email}
                    </code>
                    ? Their administrative access will be immediately terminated.
                  </>
                )}
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-medium">
                This action is audited and permanently recorded in the immutable administrative security log.
              </div>

              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{modalError}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDialog(null);
                    setModalError(null);
                  }}
                  disabled={submittingAdminAction}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.type === 'grant' ? handleConfirmGrant : handleConfirmRevoke}
                  disabled={submittingAdminAction}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 ${
                    confirmDialog.type === 'grant'
                      ? 'bg-[#0096AF] hover:bg-[#008197]'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {submittingAdminAction ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{confirmDialog.type === 'grant' ? 'Granting Access...' : 'Revoking Access...'}</span>
                    </>
                  ) : (
                    <span>{confirmDialog.type === 'grant' ? 'Confirm & Grant Privileges' : 'Confirm Revocation'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
