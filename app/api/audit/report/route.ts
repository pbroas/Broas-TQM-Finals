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
      .map((m: any) => `[${m.sender.toUpperCase()}]: ${m.content}`)
      .join('\n\n');

    const standardInfo = standard
      ? `APPROVED STANDARD: ${standard.code} - ${standard.title} (v${standard.version})
REQUIREMENTS:
${standard.requirements}
QUALITY INDICATORS:
${standard.qualityIndicators}`
      : 'NO APPROVED STANDARD LINKED. Classify benchmark status as "Not Verified".';

    const systemInstruction = PRM_QUALITY_AUDIT_REPORT_PROMPT;

    const userPrompt = `Generate the structured TQM Quality Audit Report for:
AUDIT ID: ${auditId || 'AUD-' + Date.now()}
DEPARTMENT: ${department}
EMPLOYEE ROLE: ${roleTitle}
OFFICE LOCATION: ${officeLocation}
EMPLOYEE NAME: ${employeeName || 'Staff Member'}
PROCESS UNDER AUDIT: ${processName}

${standardInfo}

FULL AUDIT TRANSCRIPT:
${conversationTranscript}

Return ONLY a valid JSON object with the following keys:
{
  "auditTitle": string,
  "summary": string,
  "workflowSteps": string[],
  "employeeChallenges": string[],
  "verifiedFindings": string[],
  "classification": "conforms" | "partial_gap" | "process_gap" | "improvement_opportunity" | "not_verified",
  "priority": "low" | "medium" | "high",
  "priorityRationale": string,
  "rootCauseAnalysis": {
    "technique": "5 Whys" | "Fishbone" | "Process Flow Gap",
    "causes": string[]
  },
  "pdcaPlan": {
    "plan": string,
    "do": string,
    "check": string,
    "act": string
  },
  "recommendedCorrectiveActions": string[],
  "suggestedOwner": string,
  "kpiIndicators": string[],
  "informationGaps": string[],
  "conclusion": string
}`;

    const fallbackResult = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });

    let reportData: any;
    try {
      reportData = JSON.parse(fallbackResult.text);
    } catch (parseErr) {
      // In case of any wrapping markdown
      const cleaned = fallbackResult.text.replace(/```json\s*|\s*```/g, '').trim();
      reportData = JSON.parse(cleaned);
    }

    return NextResponse.json({
      report: reportData,
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
