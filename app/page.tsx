'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Plus,
  FileCheck2,
  Clock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  BookOpen,
  LayoutDashboard,
  TrendingUp,
  Cpu,
  Lock,
  Layers,
  ChevronRight,
  User,
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  testConnection,
  handleFirestoreError,
  OperationType,
  SECURE_TOKEN_ACTIVATION_URL,
  checkTokenServiceHealth,
} from '@/lib/firebase';
import { Navbar } from '@/components/Navbar';
import { ProfileModal, DEPARTMENTS } from '@/components/ProfileModal';
import { NewAuditModal } from '@/components/NewAuditModal';
import { AuditWorkspace } from '@/components/AuditWorkspace';
import { AuditReportView, CLASSIFICATION_CONFIG } from '@/components/AuditReportView';
import { StandardsView } from '@/components/StandardsView';
import { AdminDashboard } from '@/components/AdminDashboard';
import { ThreatModelView } from '@/components/ThreatModelView';
import { PRMStandard, INITIAL_PRM_STANDARDS } from '@/lib/default-standards';
import { isDesignatedSuperAdmin } from '@/lib/security';

export default function HomePage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeView, setActiveView] = useState<'employee' | 'admin' | 'standards' | 'threats'>('employee');
  const [tokenNotice, setTokenNotice] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Modals & State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNewAuditModalOpen, setIsNewAuditModalOpen] = useState(false);
  const [standards, setStandards] = useState<PRMStandard[]>(INITIAL_PRM_STANDARDS);

  // Active Audit State
  const [activeAudit, setActiveAudit] = useState<{
    auditId: string;
    department: string;
    processName: string;
    roleTitle: string;
    officeLocation: string;
    employeeName: string;
    standard: PRMStandard | null;
    initialMessages?: any[];
  } | null>(null);

  // Active Report State
  const [activeReportData, setActiveReportData] = useState<any | null>(null);

  // Personal Audits List
  const [personalAudits, setPersonalAudits] = useState<any[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [searchAuditTerm, setSearchAuditTerm] = useState('');

  const fetchStandards = React.useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'standards'));
      if (!snap.empty) {
        const list: PRMStandard[] = [];
        snap.forEach((d) => list.push(d.data() as PRMStandard));
        setStandards(list);
      } else {
        setStandards(INITIAL_PRM_STANDARDS);
      }
    } catch (err) {
      console.warn('Standards fetch fallback to local defaults:', err);
      setStandards(INITIAL_PRM_STANDARDS);
    }
  }, []);

  const fetchPersonalAudits = React.useCallback(async (uid: string) => {
    setLoadingAudits(true);
    try {
      const auditsRef = collection(db, 'users', uid, 'audits');
      const snap = await getDocs(auditsRef);
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      setPersonalAudits(list);
    } catch (err) {
      console.warn('Personal audits fetch error:', err);
    } finally {
      setLoadingAudits(false);
    }
  }, []);

  // Check Token Service API health and listen to Firebase Auth state
  useEffect(() => {
    // Check if Token Service API is enabled in GCP
    checkTokenServiceHealth().then((isHealthy) => {
      if (!isHealthy) {
        setTokenNotice(true);
      }
    });

    const resolveAdminStatus = async (userObj: FirebaseUser): Promise<boolean> => {
      if (isDesignatedSuperAdmin(userObj.email)) return true;
      try {
        const tokenResult = await userObj.getIdTokenResult();
        if (tokenResult.claims?.super_admin === true || tokenResult.claims?.role === 'super_admin') {
          return true;
        }
      } catch (e) {
        console.warn('Could not read user token claims:', e);
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', userObj.uid));
        if (adminDoc.exists() && adminDoc.data()?.status === 'active') {
          return true;
        }
      } catch (e) {
        // Expected if security rules restrict non-admins from querying /admins
      }

      return false;
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Validate token health before triggering Firestore requests
        try {
          await currentUser.getIdToken();
        } catch (tokenErr: any) {
          const msg = tokenErr?.message || String(tokenErr);
          if (msg.includes('token-service-api') || msg.includes('securetoken') || msg.includes('disabled')) {
            console.warn('Token Service API not yet enabled in GCP project 648207412439:', msg);
            setTokenNotice(true);
            await signOutUser();
            setUser(null);
            setAuthLoading(false);
            return;
          }
        }

        setUser(currentUser);
        const isAdmin = await resolveAdminStatus(currentUser);
        setIsSuperAdmin(isAdmin);

        // Fetch User Profile from /users/{uid}/profile/data
        try {
          const profileDoc = await getDoc(doc(db, 'users', currentUser.uid, 'profile', 'data'));
          if (profileDoc.exists()) {
            setUserProfile(profileDoc.data());
          } else {
            // Default profile bootstrap
            const initialProf = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'PRM Team Member',
              department: DEPARTMENTS[0],
              roleTitle: 'Insurance Specialist',
              officeLocation: 'Fishers (Headquarters)',
            };
            setUserProfile(initialProf);
          }
        } catch (err: any) {
          const msg = err?.message || String(err);
          if (msg.includes('token-service-api') || msg.includes('securetoken')) {
            setTokenNotice(true);
          } else {
            console.warn('Profile fetch note:', err);
          }
        }

        // Fetch personal audits
        fetchPersonalAudits(currentUser.uid);

        // Fetch standards from Firestore for authenticated user
        fetchStandards();
      } else {
        setUser(null);
        setUserProfile(null);
        setPersonalAudits([]);
        setIsSuperAdmin(false);
        setStandards(INITIAL_PRM_STANDARDS);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchStandards, fetchPersonalAudits]);

  const refreshAdminStatus = async () => {
    if (!auth.currentUser) return;
    try {
      // Force refresh the token to obtain newly set custom claims
      await auth.currentUser.getIdToken(true);
      const tokenResult = await auth.currentUser.getIdTokenResult();
      const hasClaim = tokenResult.claims?.super_admin === true || tokenResult.claims?.role === 'super_admin';
      const isDesignated = isDesignatedSuperAdmin(auth.currentUser.email);
      let inAdminCollection = false;
      try {
        const adminDoc = await getDoc(doc(db, 'admins', auth.currentUser.uid));
        inAdminCollection = adminDoc.exists() && adminDoc.data()?.status === 'active';
      } catch (e) {
        // Ignored if access restricted
      }

      setIsSuperAdmin(isDesignated || hasClaim || inAdminCollection);
    } catch (err) {
      console.warn('Error refreshing admin status:', err);
    }
  };

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('token-service-api') || msg.includes('securetoken')) {
        setTokenNotice(true);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleStartNewAudit = (params: {
    department: string;
    processName: string;
    standard: PRMStandard | null;
  }) => {
    const newAuditId = 'AUD-' + Date.now();
    setActiveAudit({
      auditId: newAuditId,
      department: params.department,
      processName: params.processName,
      roleTitle: userProfile?.roleTitle || 'Insurance Specialist',
      officeLocation: userProfile?.officeLocation || 'Fishers (Headquarters)',
      employeeName: userProfile?.displayName || user?.email?.split('@')[0] || 'Staff Member',
      standard: params.standard,
      initialMessages: [],
    });
    setIsNewAuditModalOpen(false);
  };

  const handleResumeAudit = async (audit: any) => {
    if (!user) return;
    // If audit is already completed and has findings, offer report view
    if (audit.status === 'completed' && audit.findings) {
      try {
        const findings = typeof audit.findings === 'string' ? JSON.parse(audit.findings) : audit.findings;
        const rootCauses = typeof audit.rootCauses === 'string' ? JSON.parse(audit.rootCauses) : audit.rootCauses;
        const pdcaPlan = typeof audit.pdcaPlan === 'string' ? JSON.parse(audit.pdcaPlan) : audit.pdcaPlan;
        const kpis = typeof audit.kpiIndicators === 'string' ? JSON.parse(audit.kpiIndicators) : audit.kpiIndicators;
        const recs = typeof audit.recommendations === 'string' ? JSON.parse(audit.recommendations) : audit.recommendations;

        setActiveReportData({
          auditTitle: `Quality Audit: ${audit.processName}`,
          summary: `Historical quality audit completed on ${audit.updatedAt ? new Date(audit.updatedAt).toLocaleDateString() : 'earlier'}.`,
          workflowSteps: ['Documented during initial audit interview.'],
          employeeChallenges: ['Friction logged during audit transcript.'],
          verifiedFindings: findings,
          classification: audit.classification || 'partial_gap',
          priority: audit.priority || 'medium',
          rootCauseAnalysis: rootCauses,
          pdcaPlan: pdcaPlan,
          kpiIndicators: kpis,
          recommendedCorrectiveActions: recs,
          conclusion: 'Historical audit record finalized.',
          auditId: audit.id,
          department: audit.department,
          processName: audit.processName,
          roleTitle: audit.roleTitle,
          officeLocation: audit.officeLocation,
          employeeName: audit.employeeName,
        });
        return;
      } catch (e) {
        console.warn('Error parsing completed report, opening workspace:', e);
      }
    }

    // Otherwise load previous interactions and resume workspace
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'audits', audit.id, 'interactions'));
      const msgs: any[] = [];
      snap.forEach((d) => msgs.push(d.data()));
      msgs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

      const linkedStd = standards.find((s) => s.id === audit.standardId) || null;

      setActiveAudit({
        auditId: audit.id,
        department: audit.department,
        processName: audit.processName,
        roleTitle: audit.roleTitle || userProfile?.roleTitle || 'Insurance Specialist',
        officeLocation: audit.officeLocation || userProfile?.officeLocation || 'Fishers',
        employeeName: audit.employeeName || userProfile?.displayName || 'Staff Member',
        standard: linkedStd,
        initialMessages: msgs,
      });
    } catch (err) {
      console.error('Failed to resume audit:', err);
    }
  };

  const filteredPersonalAudits = personalAudits.filter((a) => {
    return (
      a.processName?.toLowerCase().includes(searchAuditTerm.toLowerCase()) ||
      a.department?.toLowerCase().includes(searchAuditTerm.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top Navigation */}
      <Navbar
        user={user}
        userProfile={userProfile}
        isSuperAdmin={isSuperAdmin}
        activeView={activeView}
        setActiveView={(view) => {
          setActiveView(view);
          setActiveAudit(null);
          setActiveReportData(null);
        }}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onSignIn={handleSignIn}
        onSignOut={signOutUser}
        isOnline={true}
        isSigningIn={isSigningIn}
      />

      {/* Token Service API Warning Banner */}
      {tokenNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs sm:text-sm text-amber-900 leading-snug">
                <strong className="font-semibold">Google Cloud Setup Required:</strong> The{' '}
                <em>Token Service API (securetoken.googleapis.com)</em> must be enabled in Google Cloud project{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">648207412439</code> for Firebase Authentication and Firestore to issue security tokens.
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <a
                href={SECURE_TOKEN_ACTIVATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#0096AF] hover:bg-[#008197] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <span>Enable in GCP Console</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={async () => {
                  const ok = await checkTokenServiceHealth();
                  if (ok) {
                    setTokenNotice(false);
                  } else {
                    alert('Token Service API is still initializing. Please click "Enable in GCP Console" and allow 1-2 minutes for GCP to propagate.');
                  }
                }}
                className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold rounded-lg transition-colors"
              >
                Verify Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1">
        {/* If Active Report is Open */}
        {activeReportData ? (
          <AuditReportView
            report={activeReportData}
            auditId={activeReportData.auditId || activeAudit?.auditId || 'AUD-REF'}
            department={activeReportData.department || activeAudit?.department || 'General'}
            processName={activeReportData.processName || activeAudit?.processName || 'Workflow Audit'}
            roleTitle={activeReportData.roleTitle || userProfile?.roleTitle || 'Specialist'}
            officeLocation={activeReportData.officeLocation || userProfile?.officeLocation || 'Fishers'}
            employeeName={activeReportData.employeeName || userProfile?.displayName || 'Staff Member'}
            userEmail={user?.email || ''}
            onBack={() => {
              setActiveReportData(null);
              if (user) fetchPersonalAudits(user.uid);
            }}
            onActionCreated={() => {
              if (user) fetchPersonalAudits(user.uid);
            }}
          />
        ) : activeAudit ? (
          /* If Active Audit Session is Open */
          <AuditWorkspace
            auditId={activeAudit.auditId}
            userId={user?.uid || ''}
            employeeName={activeAudit.employeeName}
            department={activeAudit.department}
            roleTitle={activeAudit.roleTitle}
            officeLocation={activeAudit.officeLocation}
            processName={activeAudit.processName}
            standard={activeAudit.standard}
            initialMessages={activeAudit.initialMessages}
            onBack={() => {
              setActiveAudit(null);
              if (user) fetchPersonalAudits(user.uid);
            }}
            onViewReport={(report) => {
              setActiveReportData(report);
            }}
          />
        ) : !user ? (
          /* Signed Out Hero Landing View */
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-teal-50 text-[#0096AF] text-xs font-bold rounded-full border border-teal-200">
                <ShieldCheck className="w-4 h-4" />
                <span>Priority Risk Management • Total Quality Management</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                AI-Powered Quality Audits for Continuous Process Improvement
              </h1>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
                Empowering PRM insurance specialists across Fishers, South Bend, and Columbus to evaluate workflow friction, compare practices against approved company benchmarks, and eliminate operational bottlenecks through the Plan-Do-Check-Act (PDCA) cycle.
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="w-full sm:w-auto px-6 py-3 bg-[#0096AF] hover:bg-[#008197] disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
                >
                  <User className="w-4 h-4" />
                  <span>{isSigningIn ? 'Connecting to Google...' : 'Sign In with Authorized Google Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 pt-1">
                TQM Principle: Focuses on process standardization and continuous improvement, never automated disciplinary action.
              </p>
            </div>

            {/* Core Capability Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-[#0096AF]/40 transition-all space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0096AF] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Guided Quality Audit Interview</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Engage in an empathetic, multi-turn interview with Gemini. Walk through real-world process steps, handoffs, duplicate data entry, and recurring delays.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-[#0096AF]/40 transition-all space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#DC582A] flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">PRM Benchmark SOP Validation</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automatically compare described employee workflows against official PRM operating procedures for Personal Lines, Commercial COIs, and Risk Advisory pipelines.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-[#0096AF]/40 transition-all space-y-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Evidence-Based PDCA Matrix</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Transform root cause analysis (5 Whys) into structured Plan-Do-Check-Act corrective action plans with measurable KPIs and accountable process ownership.
                </p>
              </div>
            </div>
          </div>
        ) : activeView === 'admin' ? (
          /* Super Admin Dashboard */
          <AdminDashboard
            userEmail={user.email || ''}
            onViewAudit={(audit) => handleResumeAudit(audit)}
            onRefreshAll={() => {
              if (user) fetchPersonalAudits(user.uid);
              fetchStandards();
            }}
            onAdminRoleChanged={refreshAdminStatus}
          />
        ) : activeView === 'standards' ? (
          /* Standards Library */
          <StandardsView
            standards={standards}
            isSuperAdmin={isSuperAdmin}
            userEmail={user.email || ''}
            onRefresh={fetchStandards}
          />
        ) : activeView === 'threats' ? (
          /* Agentic Threat Modeling */
          <ThreatModelView />
        ) : (
          /* Employee Dashboard View */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Employee Welcome & Action Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0096AF] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {userProfile?.department || 'Priority Risk Management'}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-medium text-slate-600">
                    {userProfile?.officeLocation || 'Fishers Headquarters'}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  Welcome back, {userProfile?.displayName || user.email?.split('@')[0]}
                </h1>
                <p className="text-xs text-slate-500 font-normal">
                  Participate in structured quality audits to identify workflow friction, eliminate rework, and improve customer outcomes.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsNewAuditModalOpen(true)}
                  className="px-4 py-2.5 bg-[#0096AF] hover:bg-[#008197] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start New Quality Audit</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  My Audits
                </span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">{personalAudits.length}</span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Total recorded</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  In Progress
                </span>
                <span className="text-xl font-black text-[#0096AF] mt-0.5 block">
                  {personalAudits.filter((a) => a.status === 'in_progress').length}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Active interviews</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Finalized Reports
                </span>
                <span className="text-xl font-black text-emerald-600 mt-0.5 block">
                  {personalAudits.filter((a) => a.status === 'completed').length}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Completed evaluations</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  PRM Standards
                </span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">{standards.length}</span>
                <span className="text-[10px] text-[#0096AF] font-semibold mt-0.5 block">Active SOP benchmarks</span>
              </div>
            </div>

            {/* Personal Audits History */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">My Process Quality Audits</h3>
                  <p className="text-xs text-slate-500">
                    Review completed audit reports or resume an in-progress conversational audit.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchAuditTerm}
                    onChange={(e) => setSearchAuditTerm(e.target.value)}
                    placeholder="Search my workflows..."
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF]"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredPersonalAudits.map((audit) => {
                  const isCompleted = audit.status === 'completed';
                  const classMeta =
                    CLASSIFICATION_CONFIG[audit.classification] || CLASSIFICATION_CONFIG.partial_gap;

                  return (
                    <div
                      key={audit.id}
                      className="p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-[#0096AF] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {audit.id}
                          </span>
                          <span className="text-xs font-semibold text-slate-700">{audit.department}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500">{audit.standardCode || 'No Standard'}</span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{audit.processName}</h4>
                        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                          <span>
                            Last updated:{' '}
                            {audit.updatedAt ? new Date(audit.updatedAt).toLocaleDateString() : 'Recently'}
                          </span>
                          {isCompleted && (
                            <span className={`font-semibold ${classMeta.text}`}>
                              • {classMeta.label}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isCompleted ? 'Report Finalized' : 'In Progress'}
                        </span>

                        <button
                          onClick={() => handleResumeAudit(audit)}
                          className="px-3.5 py-1.5 text-xs font-bold text-[#0096AF] hover:text-white bg-teal-50 hover:bg-[#0096AF] border border-teal-200 rounded-lg transition-colors flex items-center space-x-1"
                        >
                          <span>{isCompleted ? 'View Report' : 'Resume Audit'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredPersonalAudits.length === 0 && !loadingAudits && (
                  <div className="p-12 text-center">
                    <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No quality audits found.</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Start your first workflow evaluation to discover continuous improvement opportunities.
                    </p>
                    <button
                      onClick={() => setIsNewAuditModalOpen(true)}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0096AF] text-white text-xs font-bold rounded-lg shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Start Quality Audit</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Profile Setup Modal */}
      {user && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          uid={user.uid}
          email={user.email || ''}
          currentProfile={userProfile}
          onProfileUpdated={(p) => setUserProfile(p)}
        />
      )}

      {/* New Audit Modal */}
      <NewAuditModal
        isOpen={isNewAuditModalOpen}
        onClose={() => setIsNewAuditModalOpen(false)}
        userProfile={userProfile}
        standards={standards}
        onStartAudit={handleStartNewAudit}
      />
    </div>
  );
}
