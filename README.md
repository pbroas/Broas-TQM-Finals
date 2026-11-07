# PRM Quality Intelligence
### AI-Powered Quality Audit and Continuous Process Improvement Platform
**Priority Risk Management (PRM) • Fishers, Indiana**

---

## 1. Executive Summary & Purpose

**PRM Quality Intelligence** is a secure, authenticated enterprise web application developed for **Priority Risk Management (PRM)**, an independent insurance agency headquartered in Fishers, Indiana, with regional offices in South Bend and Columbus.

The platform operationalizes **Total Quality Management (TQM)** principles across five core insurance agency departments:
1. **Personal Lines** (Renewal reviews, 60-45-30 day outreach, remarketing thresholds)
2. **Commercial Lines** (Certificate of Insurance / ACORD 25 turnaround, 90-day renewal marketing, additional insured checks)
3. **Risk Advisors & Sales** (AgencyZoom 15-minute lead velocity, 12-point exposure checklist, proposal delivery)
4. **Reception & Support Operations** (RingCentral warm transfer triage, 2-hour voicemail turnaround, emergency claims escalation)
5. **Administration & Operations** (AMS360 IVANS download exceptions, cross-system reconciliation, task SLA enforcement)

The application provides a conversational quality audit interview with **Google Gemini AI**, compares frontline practices against approved company Standard Operating Procedures (SOPs), executes Root Cause Analysis (5 Whys / Fishbone), and produces structured **Plan-Do-Check-Act (PDCA)** continuous improvement plans.

> **TQM Quality Pledge:** This platform is strictly dedicated to process stabilization and continuous improvement. It does not perform automated employee disciplinary scoring or insurance coverage legal determinations.

---

## 2. Agentic Threat Summary Table

Structured scenario-driven security analysis conducted across the Five Threat Zones in accordance with OWASP Top 10 Web Application and OWASP LLM Application Security standards:

| Threat Zone | Identified Risk | Severity | Potential Impact | Preventive Control | Verification Method |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **1. Input Surfaces** | Customer PII exposure (SSNs, policy numbers, claim data) in audit conversation | **High** | Regulatory breach (GLBA, Indiana privacy laws), client trust loss | Client and server-side regex sanitization (`sanitizeAndRedact`) that detects and redacts SSNs, card numbers, and license tokens prior to Gemini and Firestore storage | Automated test suite in `security_spec.md`; visual alert banner in UI |
| **2. Planning & Reasoning** | Prompt injection attempting to falsify compliance or override TQM auditor rules | **High** | Fictitious compliance certifications; bypass of PRM SOP checks | Strictly delimited system context blocks; immutable system instructions; structured JSON schema enforcement via resilient fallback protocol | Adversarial jailbreak payloads tested in `security_spec.md` |
| **3. Tool Execution** | Server-Side Request Forgery (SSRF) or unauthorized internal API execution | **Critical** | Compromised cloud metadata, token exfiltration, or unauthorized CRM mutations | Server-side only Next.js API proxy routes (`/api/*`); no client API keys; zero dynamic arbitrary URL fetching | Static code auditing confirming all external network calls target authorized Google GenAI / Firebase endpoints |
| **4. Memory & State** | Insecure Direct Object Reference (IDOR) & cross-user audit record harvesting | **Critical** | Employee private workflow admissions viewed by unauthorized peers | Hardened Zero-Trust Firestore Security Rules enforcing owner-bound hierarchy `/users/{userId}/audits/{auditId}` (`request.auth.uid == userId`) | Phase 5 Red Team audit suite rejecting cross-user reads and unauthenticated lists |
| **5. Inter-System Communication** | Leaked Gemini API keys or service account credentials in client bundles | **Critical** | Account quota exhaustion, unauthorized external inference | Zero-hardcoding hygiene: `GEMINI_API_KEY` retrieved strictly via server-side environment variables / Secret Manager; no `NEXT_PUBLIC_` leaks | Production bundle review verifying zero secret exposure in browser assets |

---

## 3. Technology Stack & Architecture

- **Frontend & App Framework:** Next.js 15+ (App Router), React 19, TypeScript
- **Styling & Design System:** Tailwind CSS v4, Lucide React icons, PRM Teal (`#0096AF`) and Orange (`#DC582A`)
- **Authentication:** Firebase Authentication with Google Sign-In (Pop-up flow)
- **Database:** Google Cloud Firestore (Enterprise Edition) with owner-bound Zero-Trust security rules
- **AI Engine:** Google Gemini API (`@google/genai` TypeScript SDK)
- **Model Fallback Ladder:**
  1. Primary: `gemini-3.6-flash`
  2. High-Availability Fallback: `gemini-3.1-flash-lite`
  3. Dynamic Alias: `gemini-flash-latest`
  4. Deep Reasoning / Standard: `gemini-3.7-flash` (and `gemini-2.5-flash`)

---

## 4. Setup, Environment & Secret Management

### Prerequisites
- Node.js 20+
- Google Cloud Project with Cloud Run and Secret Manager enabled
- Firebase project with Google Authentication and Cloud Firestore provisioned

### Secret Management Configuration
Store runtime credentials securely in Google Cloud Secret Manager:

```bash
# 1. Create Gemini API Secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 2. Add secret version
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant Cloud Run Service Account Secret Accessor permission
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
    --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### Environment Variables (`.env.local`)
```env
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
APP_URL="https://your-domain.run.app"
```

---

## 5. Firestore Zero-Trust Security Rules

Stored in `/firestore.rules` and deployed to Cloud Firestore:

- **User Profile Isolation:** `/users/{userId}/profile/data` — readable and writable only by the authenticated owner (`request.auth.uid == userId`).
- **Owner-Bound Audit Sessions:** `/users/{userId}/audits/{auditId}` — personal audits readable only by the owner or authorized Super Admin (`isAdmin()`).
- **Immutable Interaction Transcripts:** `/users/{userId}/audits/{auditId}/interactions/{interactionId}` — append-only audit conversation logs; cannot be edited after creation.
- **Terminal State Locking:** Once an audit is finalized (`status == 'completed'`), regular users cannot overwrite findings; only admins can archive or annotate.
- **Company Standards Library:** `/standards/{standardId}` — read-only for verified PRM staff; write access restricted strictly to verified Super Administrators.
- **PDCA Action Items:** `/actions/{actionId}` — organization-wide continuous improvement tracking readable by staff, manageable by action owners and Super Admins.

Deploy rules via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 6. Cloud Run Deployment

Deploy the containerized application to Google Cloud Run with the course-required resource label:

```bash
gcloud run deploy prm-quality-intelligence \
    --source . \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars="NODE_ENV=production" \
    --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
    --labels="dev-tutorial=cloud-run-ai-challenge"
```

---

## 7. Total Quality Management (TQM) Audit Framework

### The 5-Phase Conversational Audit Interview
1. **Step Mapping:** Document the end-to-end procedural path triggered by a business event.
2. **Friction Analysis:** Uncover delays, manual rework, duplicate entry between AMS360 and carrier portals, and unclear handoffs.
3. **5 Whys Root Cause Analysis:** Probe beyond surface symptoms to identify systemic operational deficiencies.
4. **Benchmark SOP Comparison:** Contrast actual practices against approved PRM Standard Operating Procedures.
5. **PDCA Continuous Improvement Synthesis:** Generate a structured Plan-Do-Check-Act matrix with measurable KPIs and designated process owners.

### Findings Classification Standards
- **Conforms:** Full alignment with approved PRM Standard Operating Procedures.
- **Partial Gap:** Functional workflow with specific bottlenecks or missing control gates.
- **Process Gap:** Meaningful deviation from approved company policy or critical missing verification.
- **Improvement Opportunity:** Compliant workflow with high-leverage automation or velocity potential.
- **Not Verified:** Workflow evaluated without an approved benchmark standard on file.

---

## 8. Super Administrator Roles & Multi-Admin Management

### Root Administrator
The permanently authorized root Super Administrator account is configured as:
`paulineingrid123@gmail.com`

The root Super Administrator cannot be removed or revoked under any circumstances, guaranteeing permanent administrative continuity.

### Multi-Administrator Architecture
The application supports multiple concurrent Super Administrators across Google accounts inside and outside the PRM organization:
1. **Firebase Custom Claims:** Authorized administrators receive the secure backend custom claim `{ super_admin: true }` set via the Firebase Admin SDK (`setCustomUserClaims`).
2. **Synchronized Role Registry:** Every administrative assignment is persisted in the Cloud Firestore `/admins/{uid}` collection with status, grantor metadata, and grant timestamps.
3. **Immutable Administrative Audit Log:** Every grant and revoke operation is permanently recorded in `/admin_audit_logs/{logId}` with action type, target email, grantor/revoker identity, timestamp, and notes. Rules forbid modifications or deletions to audit records.
4. **Zero-Lockout Safeguards:** The system mathematically prohibits revoking privileges from the root administrator or when only one active Super Administrator remains.
5. **Dynamic Token Refresh:** The client invokes `user.getIdToken(true)` following role modification to reflect new custom claims immediately without requiring re-authentication.

### Admin Management Dashboard Features
Authorized Super Admins have access to the **Admin Intelligence** dashboard tabs:
- **Quality Intelligence Overview:** Live aggregate quality metrics, department distributions, and process gap radar across PRM departments.
- **Standards Management:** Company Quality Standards Library management (add, edit, version, and archive SOPs).
- **PDCA Action Tracker:** Organization-wide continuous improvement action tracker with status lifecycle management.
- **Admin Management:** View all active Super Administrators, add new administrators by Google email address, revoke administrative access with safety confirmations, and inspect the chronological administrative role audit log.
- **Security Threat Model:** Explorer covering the Five Threat Zones and interactive PII Redaction Sandbox.

---

## 9. Academic Deliverables & Verification Checklist

- [x] Application Name: **PRM Quality Intelligence**
- [x] Designated Root Super Admin Account: `paulineingrid123@gmail.com`
- [x] Support for Multiple Super Administrator accounts with backend custom claims
- [x] Dedicated **Admin Management** section with grant, revoke, and audit logging
- [x] Immutable Administrative Role Audit Log in `/admin_audit_logs`
- [x] Centralized, reusable Application-Level Quality Audit Prompt (`PRM_QUALITY_AUDIT_SYSTEM_PROMPT`)
- [x] Agentic Threat Summary Table covering all 5 threat zones
- [x] `security_spec.md` with Data Invariants and the Dirty Dozen attack tests
- [x] `firebase-blueprint.json` strictly conforming to intermediate representation schema
- [x] `firestore.rules` deployed with Zero-Trust owner isolation, terminal state locking, and multi-admin authorization
- [x] Server-side Gemini API with resilient fallback ladder protocol
- [x] Pre-loaded PRM Standard Operating Procedures for all 5 departments
- [x] Cloud Run deployment instructions with label `dev-tutorial=cloud-run-ai-challenge`
