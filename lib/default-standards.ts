export interface PRMStandard {
  id: string;
  code: string;
  title: string;
  department: string;
  version: string;
  effectiveDate: string;
  scope: string;
  requirements: string;
  qualityIndicators: string;
  status: 'active' | 'archived' | 'draft';
  authorEmail: string;
  createdAt?: string;
  updatedAt?: string;
}

export const INITIAL_PRM_STANDARDS: PRMStandard[] = [
  {
    id: 'PRM-SOP-PL-01',
    code: 'PRM-SOP-PL-01',
    title: 'Personal Lines Renewal Preparation & Remarketing Standard',
    department: 'Personal Lines',
    version: '2.4',
    effectiveDate: '2026-01-15',
    scope: 'All Personal Lines Account Managers and Service Specialists across Fishers, South Bend, and Columbus offices.',
    requirements: `1. Renewal Timeline Trigger: Review upcoming expiration report in AMS360 at 60 days prior to policy renewal date.
2. Premium Variance Threshold: If renewal premium increases by >10% or >$200 across auto or homeowners packages, initiate immediate remarketing review.
3. Pre-Contact Account Audit: Verify coverage limits, deductible alignments, home improvement credits, and auto safety discounts before reaching out.
4. Client Outreach Sequence: Initial review email sent at 45 days. Follow-up phone call at 30 days if no client confirmation. Document all attempts in CRM.
5. Remarketing Protocol: Submit quote packages to at least 2 alternative admitted carriers when remarketing is triggered.
6. Documentation: Log final outcome, remarketed quotes, client communication summaries, and binder confirmations in the agency management system.`,
    qualityIndicators: 'Renewal preparation timeliness (% reviewed at 60 days >= 95%), client follow-up completion rate (>= 98%), documentation completeness index (>= 92%), repeat service request frequency (< 5%).',
    status: 'active',
    authorEmail: 'paulineingrid123@gmail.com',
  },
  {
    id: 'PRM-SOP-CL-04',
    code: 'PRM-SOP-CL-04',
    title: 'Commercial Certificate of Insurance (COI) & Carrier Submission Standard',
    department: 'Commercial Lines',
    version: '3.1',
    effectiveDate: '2026-02-01',
    scope: 'Commercial Lines Account Executives, CSRs, and Certificate Specialists.',
    requirements: `1. Intake & Ticket Verification: All COI requests must be received via approved agency portal or centralized email (certificates@priorityrisk.com) with contract insurance requirements attached.
2. Form Compliance: Only standard ACORD 25 certificates may be issued. Wordings requiring unconditional hold harmless or non-admitted coverage terms must be referred to underwriting counsel.
3. Additional Insured & Waiver Verification: Confirm underlying policy endorsements (e.g. CG 20 10, CG 24 04) are active before checking the corresponding boxes.
4. Turnaround Guarantee: Standard certificate requests processed within 4 business hours. Urgent rush requests processed within 60 minutes.
5. Record Retention: Automatic upload of signed certificate PDF to AMS360 commercial policy file with certificate holder cross-index.
6. Quality Note: The AI auditor does not make legal determinations regarding contract sufficiency.`,
    qualityIndicators: 'COI turnaround time (avg < 3.2 hrs), Certificate issuance accuracy (>= 99.4%), rework / correction rate (< 2%), renewal submission timeliness (90 days prior for middle market).',
    status: 'active',
    authorEmail: 'paulineingrid123@gmail.com',
  },
  {
    id: 'PRM-SOP-RA-02',
    code: 'PRM-SOP-RA-02',
    title: 'Risk Advisor Lead Intake, Pipeline Velocity & Proposal Delivery Standard',
    department: 'Risk Advisors and Sales',
    version: '1.8',
    effectiveDate: '2026-03-01',
    scope: 'Commercial and Personal Risk Advisors, Producers, and Business Development Specialists.',
    requirements: `1. Lead Intake & Response Velocity: Inbound web, referral, and partner leads logged in AgencyZoom must receive initial Advisor contact within 15 minutes during business hours.
2. Initial Discovery & Risk Assessment: Conduct structured 12-point exposure checklist to identify coverage gaps, cyber exposures, flood hazards, and umbrella needs.
3. Pipeline Stage Integrity: Transition stage in AgencyZoom within 24 hours of each milestone (Contact Made -> Discovery Completed -> Quoting -> Proposal Delivered -> Won/Lost).
4. Proposal Delivery: Present formal Risk Advisory proposal including comparison of existing vs proposed limits, retention options, and premium breakdowns.
5. Lost Business Debrief: Any lost prospect over $5,000 revenue requires documented reason category (Price, Incumbent Relationship, Coverage Scope, Timing).`,
    qualityIndicators: 'Initial response time (median < 15 min), pipeline stage data completeness (>= 96%), proposal turnaround from discovery (< 5 business days), lost business debrief compliance (>= 90%).',
    status: 'active',
    authorEmail: 'paulineingrid123@gmail.com',
  },
  {
    id: 'PRM-SOP-OPS-03',
    code: 'PRM-SOP-OPS-03',
    title: 'RingCentral Client Communication Triage & Support Handoff Standard',
    department: 'Reception and Support Operations',
    version: '2.0',
    effectiveDate: '2026-01-20',
    scope: 'Receptionists, First Contact Specialists, and Client Service Representatives.',
    requirements: `1. Call Answering Standard: RingCentral calls answered within 3 rings with standard greeting: "Thank you for calling Priority Risk Management, this is [Name], how may I protect your priorities today?"
2. Intelligent Routing: Triage caller intent (Billing, New Claim, Renewal, Certificate, New Policy) before transfer. Use warm transfer protocol with caller name and policy number.
3. Escalation Protocols: Open claims and distressed policyholders escalated immediately to Senior Account Manager or Claims Advocate; never send to general voicemail.
4. Voicemail & Message Turnaround: Voicemails transcribed and distributed via RingCentral webhook to departmental queue within 15 minutes; customer callback within 2 hours.
5. Ticket Handoff Integrity: Create service task in AMS with caller contact info, policy number, and concise notes before closing call log.`,
    qualityIndicators: 'First-call resolution / correct routing rate (>= 94%), average ring response time (< 12 seconds), voicemail turnaround (100% within 2 hours), repeat call inquiries for same issue (< 4%).',
    status: 'active',
    authorEmail: 'paulineingrid123@gmail.com',
  },
  {
    id: 'PRM-SOP-ADM-01',
    code: 'PRM-SOP-ADM-01',
    title: 'Cross-System Reconciliation & Agency Automation Integrity Standard',
    department: 'Administration and Operations',
    version: '2.2',
    effectiveDate: '2026-02-15',
    scope: 'Operations Managers, Systems Administrators, and Accounting Personnel.',
    requirements: `1. Daily Download Exception Clearing: Review IVANS policy download exceptions in AMS360 daily by 10:00 AM EST.
2. Cross-System Sync Integrity: Reconcile active policies between AMS360, AgencyZoom, and carrier direct-bill statements weekly.
3. Account De-duplication: Run monthly duplicate client/contact scan; merge duplicate records while preserving historical activity logs and attachment associations.
4. Task Assignment & SLA Monitoring: Audit unassigned and overdue tasks across all branches every Friday. Escalate bottlenecks to Department Heads.
5. User Access & Role Deprovisioning: Remove terminated employee credentials within 2 hours of notification; archive audit trails.`,
    qualityIndicators: 'Download exception backlog (= 0 by end of day), cross-system sync reconciliation variance (< 0.1%), overdue task rate (< 3%), role deprovisioning compliance (100%).',
    status: 'active',
    authorEmail: 'paulineingrid123@gmail.com',
  },
];
