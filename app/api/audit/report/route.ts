import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback } from '@/lib/gemini-fallback';
import { PRM_QUALITY_AUDIT_REPORT_PROMPT } from '@/src/prompts/qualityAuditPrompt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      auditId,
      department,
      roleTitle,
      officeLocation,
      processName,
      standard,
      messages = [],
      employeeName,
    } = body;

    if (!processName || !messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Audit session requires at least one interaction before generating a final report.' },
        { status: 400 }
      );
    }

    const conversationTranscript = messages
      .map((m: any) => `[${(m.sender || 'USER').toUpperCase()}]: ${m.content}`)
      .join('\n\n');

    const standardInfo = standard
      ? `APPROVED STANDARD: ${standard.code} - ${standard.title} (v${standard.version})
REQUIREMENTS:
${standard.requirements}
QUALITY INDICATORS:
${standard.qualityIndicators}`
      : 'NO APPROVED STANDARD LINKED. Classify benchmark status as "Not Verified".';

    const systemInstruction = PRM_QUALITY_AUDIT_REPORT_PROMPT;

    const userPrompt = `Generate the structured 4-Section TQM Quality Audit Report for:
AUDIT ID: ${auditId || 'AUD-' + Date.now()}
DEPARTMENT: ${department}
EMPLOYEE ROLE: ${roleTitle}
OFFICE LOCATION: ${officeLocation}
EMPLOYEE NAME: ${employeeName || 'Staff Member'}
PROCESS UNDER AUDIT: ${processName}

${standardInfo}

FULL AUDIT TRANSCRIPT:
${conversationTranscript}

Return ONLY a valid JSON object strictly conforming to this 4-section schema:
{
  "auditTitle": string,
  
  "section1_ProcessFindings": {
    "summary": string,
    "workflowSteps": string[],
    "classification": "conforms" | "partial_gap" | "process_gap" | "improvement_opportunity" | "not_verified",
    "priority": "low" | "medium" | "high",
    "priorityRationale": string,
    "slaAssessment": string
  },

  "section2_IdentifiedChallenges": {
    "challenges": string[],
    "bottlenecks": string[],
    "reworkAndDuplicateEntry": string[],
    "handoffFriction": string[]
  },

  "section3_PotentialRootCauses": {
    "technique": "5 Whys & Ishikawa Analysis",
    "fiveWhysChain": string[],
    "ishikawaCategories": {
      "peopleAndRoles": string[],
      "processAndMethods": string[],
      "technologyAndSystems": string[],
      "carrierAndExternal": string[]
    }
  },

  "section4_RecommendedCorrectiveActions": {
    "pdcaMatrix": {
      "plan": string,
      "do": string,
      "check": string,
      "act": string
    },
    "actionItems": [
      {
        "action": string,
        "rationale": string,
        "suggestedOwner": string,
        "targetTimeline": string,
        "kpiMetric": string
      }
    ],
    "kpiIndicators": string[]
  },

  "conclusion": string
}`;

    const fallbackResult = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });

    let rawData: any;
    try {
      rawData = JSON.parse(fallbackResult.text);
    } catch {
      const cleaned = fallbackResult.text.replace(/```json\s*|\s*```/g, '').trim();
      rawData = JSON.parse(cleaned);
    }

    // Normalize and provide both structured 4-section access and legacy fields
    const s1 = rawData.section1_ProcessFindings || {};
    const s2 = rawData.section2_IdentifiedChallenges || {};
    const s3 = rawData.section3_PotentialRootCauses || {};
    const s4 = rawData.section4_RecommendedCorrectiveActions || {};

    const allChallenges = [
      ...(s2.challenges || []),
      ...(s2.bottlenecks || []),
      ...(s2.reworkAndDuplicateEntry || []),
      ...(s2.handoffFriction || []),
    ];

    const actionList = (s4.actionItems || []).map((item: any) =>
      typeof item === 'string' ? item : item.action
    );

    const normalizedReport = {
      auditTitle: rawData.auditTitle || `Process Quality Audit: ${processName}`,
      // 4 Structured Sections
      section1_ProcessFindings: {
        summary: s1.summary || rawData.summary || 'Comprehensive quality review completed.',
        workflowSteps: s1.workflowSteps || rawData.workflowSteps || [],
        classification: s1.classification || rawData.classification || 'partial_gap',
        priority: s1.priority || rawData.priority || 'medium',
        priorityRationale: s1.priorityRationale || rawData.priorityRationale || 'Evaluated for operational workflow stability.',
        slaAssessment: s1.slaAssessment || 'Evaluated against PRM service level benchmarks.',
      },
      section2_IdentifiedChallenges: {
        challenges: s2.challenges || rawData.employeeChallenges || allChallenges,
        bottlenecks: s2.bottlenecks || [],
        reworkAndDuplicateEntry: s2.reworkAndDuplicateEntry || [],
        handoffFriction: s2.handoffFriction || [],
      },
      section3_PotentialRootCauses: {
        technique: s3.technique || '5 Whys & Ishikawa Analysis',
        fiveWhysChain: s3.fiveWhysChain || rawData.rootCauseAnalysis?.causes || [],
        ishikawaCategories: s3.ishikawaCategories || {
          peopleAndRoles: [],
          processAndMethods: [],
          technologyAndSystems: [],
          carrierAndExternal: [],
        },
      },
      section4_RecommendedCorrectiveActions: {
        pdcaMatrix: s4.pdcaMatrix || rawData.pdcaPlan || {
          plan: 'Establish standardized baseline.',
          do: 'Implement pilot workflow.',
          check: 'Measure error rate and turnaround delta.',
          act: 'Standardize successful practices in agency SOP.',
        },
        actionItems: s4.actionItems || actionList.map((a: string) => ({
          action: a,
          rationale: 'Addresses identified workflow gap.',
          suggestedOwner: `${department} Team Lead`,
          targetTimeline: '30 Days',
          kpiMetric: 'Turnaround time and rework rate reduction',
        })),
        kpiIndicators: s4.kpiIndicators || rawData.kpiIndicators || [],
      },
      conclusion: rawData.conclusion || 'Audit completed with continuous improvement opportunities identified.',

      // Backward-compatible flat keys for existing consumers & Firestore writes
      summary: s1.summary || rawData.summary || 'Comprehensive quality review completed.',
      workflowSteps: s1.workflowSteps || rawData.workflowSteps || [],
      employeeChallenges: allChallenges.length > 0 ? allChallenges : (rawData.employeeChallenges || []),
      verifiedFindings: s1.workflowSteps || rawData.verifiedFindings || [],
      classification: s1.classification || rawData.classification || 'partial_gap',
      priority: s1.priority || rawData.priority || 'medium',
      priorityRationale: s1.priorityRationale || rawData.priorityRationale || 'Evaluated for operational workflow stability.',
      rootCauseAnalysis: {
        technique: s3.technique || '5 Whys',
        causes: s3.fiveWhysChain || rawData.rootCauseAnalysis?.causes || [],
      },
      pdcaPlan: s4.pdcaMatrix || rawData.pdcaPlan || {},
      kpiIndicators: s4.kpiIndicators || rawData.kpiIndicators || [],
      recommendedCorrectiveActions: actionList.length > 0 ? actionList : (rawData.recommendedCorrectiveActions || []),
      suggestedOwner: s4.actionItems?.[0]?.suggestedOwner || `${department} Operations Lead`,
    };

    return NextResponse.json({
      report: normalizedReport,
      modelUsed: fallbackResult.modelUsed,
      attempts: fallbackResult.attempts,
    });
  } catch (err: any) {
    console.error('Report Generation Error:', err);
    return NextResponse.json(
      {
        error: 'Failed to synthesize TQM quality audit report.',
        details: err.message || String(err),
      },
      { status: 500 }
    );
  }
}
