import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback } from '@/lib/gemini-fallback';
import { sanitizeAndRedact } from '@/lib/security';
import { PRM_QUALITY_AUDIT_SYSTEM_PROMPT, formatAuditContextData } from '@/src/prompts/qualityAuditPrompt';

// Helper to calculate TQM phase from conversation depth
function determineTqmPhase(messageCount: number): string {
  if (messageCount <= 1) return 'step_mapping';
  if (messageCount <= 3) return 'friction_analysis';
  if (messageCount <= 5) return 'root_cause';
  if (messageCount <= 7) return 'benchmark_comparison';
  return 'pdca_synthesis';
}

// Generates highly tailored, department-specific quick replies if AI skips or malforms JSON
function generateContextualQuickReplies(
  auditorText: string,
  department: string,
  processName: string,
  messageCount: number
): string[] {
  const textLower = auditorText.toLowerCase();
  const deptLower = (department || '').toLowerCase();

  // Root cause 5 Whys probing
  if (
    textLower.includes('why') ||
    textLower.includes('cause') ||
    textLower.includes('root') ||
    textLower.includes('driver') ||
    textLower.includes('underlying')
  ) {
    if (deptLower.includes('commercial')) {
      return [
        'Missing ACORD 25 certificate endorsements delay turnaround time.',
        'Client requests require manual underwriter verification before binding.',
        'Lack of integration between AMS360 and carrier portals requires duplicate re-entry.',
      ];
    }
    if (deptLower.includes('personal')) {
      return [
        'Renewal premium increases over 10% force manual remarketing across carriers.',
        'Delayed insured document submissions stall the 45-day review timeline.',
        'Duplicate entry across carrier rating tools creates avoidable processing backlogs.',
      ];
    }
    if (deptLower.includes('sales') || deptLower.includes('advisor')) {
      return [
        'Incomplete intake data from initial leads slows quote generation.',
        'Manual risk exposure review checklists take time to compile.',
        'Handoff documentation between sales and servicing lacks formal templates.',
      ];
    }
    return [
      'Intake information is frequently incomplete upon initial receipt.',
      'Manual duplicate entry between agency systems slows processing.',
      'Lack of automated status alerts causes requests to stall.',
    ];
  }

  // PDCA & improvement recommendations
  if (
    textLower.includes('pdca') ||
    textLower.includes('improv') ||
    textLower.includes('corrective') ||
    textLower.includes('recommend') ||
    textLower.includes('solution') ||
    textLower.includes('kpi')
  ) {
    return [
      'Standardize an agency-wide intake checklist to eliminate missing information.',
      'Implement automated reminder notifications for client and underwriter follow-ups.',
      'Define clear AMS360 activity suspense benchmarks to track turnaround SLAs.',
    ];
  }

  // Delays, turnaround, bottlenecks
  if (
    textLower.includes('delay') ||
    textLower.includes('turnaround') ||
    textLower.includes('bottleneck') ||
    textLower.includes('how long') ||
    textLower.includes('wait')
  ) {
    return [
      'Carrier underwriting responses average 3 to 5 business days.',
      'Waiting on policyholder documentation causes the longest delay.',
      'Peak renewal volumes create month-end processing backlogs.',
    ];
  }

  // Systems and duplicate data entry
  if (
    textLower.includes('ams360') ||
    textLower.includes('portal') ||
    textLower.includes('tool') ||
    textLower.includes('system') ||
    textLower.includes('software') ||
    textLower.includes('agencyzoom') ||
    textLower.includes('ringcentral')
  ) {
    return [
      'We log notes and suspense dates directly in AMS360.',
      'Carrier portals require manual duplicate re-entry of client details.',
      'AgencyZoom pipeline alerts trigger our initial outreach tasks.',
    ];
  }

  // Standards, SOPs, checklists
  if (
    textLower.includes('standard') ||
    textLower.includes('sop') ||
    textLower.includes('checklist') ||
    textLower.includes('benchmark') ||
    textLower.includes('guideline')
  ) {
    return [
      'We follow the standard PRM review timeline in AMS360.',
      'We currently lack a formal step-by-step checklist for this workflow.',
      'Custom client endorsements require non-standard manual steps.',
    ];
  }

  // Initial steps & triggers (Turns 1-2)
  if (messageCount <= 2 || textLower.includes('trigger') || textLower.includes('begin') || textLower.includes('start')) {
    if (deptLower.includes('commercial')) {
      return [
        'Requests arrive via email and require checking certificate holder requirements.',
        'We review policy schedules and carrier limits in AMS360 first.',
        'Renewal processing begins 90 days before commercial expiration.',
      ];
    }
    if (deptLower.includes('sales') || deptLower.includes('advisor')) {
      return [
        'New leads are automatically routed and assigned in AgencyZoom.',
        'Initial discovery call is scheduled to collect risk profile and loss history.',
        'Quote preparation begins once all driver and property details are verified.',
      ];
    }
    if (deptLower.includes('reception') || deptLower.includes('communication')) {
      return [
        'Inbound calls arrive via RingCentral and are routed by policy department.',
        'When specialists are unavailable, we log an AMS360 activity suspense.',
        'Voicemail triage prioritizes urgent claims before general inquiries.',
      ];
    }
    if (deptLower.includes('operations') || deptLower.includes('admin')) {
      return [
        'Daily IVANS download exceptions are reviewed each morning in AMS360.',
        'Suspense tracking ensures policy change documentation is archived.',
        'Commission reconciliation requires matching carrier statements manually.',
      ];
    }
    return [
      'We pull the AMS360 expiration report 45 to 60 days in advance.',
      'We contact the insured by phone and follow up with a review email.',
      'Inbound client service requests trigger the initial workflow.',
    ];
  }

  // Default fallback
  return [
    `We document key milestone dates and client notes in AMS360 for ${processName}.`,
    'Client delays and carrier turnaround times represent our biggest friction.',
    'Clearer handoffs and standardized checklists would improve quality.',
  ];
}

// Parses JSON metadata from Gemini response or falls back to intelligent contextual prompts
function parseQuickPromptsFromResponse(
  rawText: string,
  department: string,
  processName: string,
  messageCount: number
): { cleanReply: string; meta: { tqmPhase: string; suggestedQuickReplies: string[]; readyForReport: boolean } } {
  let cleanReply = rawText;
  let parsedMeta: any = null;

  // 1. Try markdown JSON block at the end of the text
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let match;
  let lastMatch = null;
  while ((match = jsonBlockRegex.exec(rawText)) !== null) {
    lastMatch = match;
  }

  if (lastMatch) {
    try {
      const candidate = JSON.parse(lastMatch[1]);
      if (candidate && Array.isArray(candidate.suggestedQuickReplies) && candidate.suggestedQuickReplies.length > 0) {
        parsedMeta = candidate;
        cleanReply = (rawText.substring(0, lastMatch.index) + rawText.substring(lastMatch.index + lastMatch[0].length)).trim();
      }
    } catch {
      // Continue
    }
  }

  // 2. Try raw trailing JSON object if markdown block was omitted
  if (!parsedMeta) {
    const braceMatch = rawText.match(/\{\s*"tqmPhase"[\s\S]*?"suggestedQuickReplies"[\s\S]*?\}/);
    if (braceMatch) {
      try {
        const candidate = JSON.parse(braceMatch[0]);
        if (candidate && Array.isArray(candidate.suggestedQuickReplies) && candidate.suggestedQuickReplies.length > 0) {
          parsedMeta = candidate;
          cleanReply = rawText.replace(braceMatch[0], '').trim();
        }
      } catch {
        // Continue
      }
    }
  }

  // 3. If Gemini supplied valid custom quick replies, sanitize and return them
  if (
    parsedMeta &&
    Array.isArray(parsedMeta.suggestedQuickReplies) &&
    parsedMeta.suggestedQuickReplies.length >= 2
  ) {
    const validReplies = parsedMeta.suggestedQuickReplies
      .map((r: any) => String(r).trim().replace(/^["']|["']$/g, ''))
      .filter((r: string) => r.length > 3 && r.length < 140)
      .slice(0, 4);

    if (validReplies.length >= 2) {
      return {
        cleanReply,
        meta: {
          tqmPhase: parsedMeta.tqmPhase || determineTqmPhase(messageCount),
          suggestedQuickReplies: validReplies,
          readyForReport: Boolean(parsedMeta.readyForReport || messageCount >= 6),
        },
      };
    }
  }

  // 4. Fall back to contextual dynamic replies derived from auditor questions and TQM phase
  const dynamicReplies = generateContextualQuickReplies(cleanReply, department, processName, messageCount);
  return {
    cleanReply,
    meta: {
      tqmPhase: determineTqmPhase(messageCount),
      suggestedQuickReplies: dynamicReplies,
      readyForReport: messageCount >= 6,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      department = 'General Agency',
      roleTitle = 'Insurance Specialist',
      officeLocation = 'Fishers (HQ)',
      processName,
      standard,
      messages = [],
      currentInput = '',
    } = body;

    // Validate request structure
    if (!processName || typeof processName !== 'string') {
      return NextResponse.json({ error: 'Missing processName parameter' }, { status: 400 });
    }

    // Sanitize and redact user input
    const { sanitizedText, warnings } = sanitizeAndRedact(currentInput || '');

    // Centralized Application-Level Quality Audit System Prompt
    const systemInstruction = PRM_QUALITY_AUDIT_SYSTEM_PROMPT;

    // Dynamically format employee, department, workflow, and approved standards context
    const dynamicAuditContext = formatAuditContextData({
      department,
      roleTitle,
      officeLocation,
      processName,
      standard,
    });

    // Build chat contents history for Gemini with untrusted context isolation
    const contents: any[] = [
      {
        role: 'user',
        parts: [
          {
            text: `${dynamicAuditContext}\n\nPlease begin or continue our structured TQM quality audit interview in accordance with the PRM Quality Audit System Prompt. Remember:
1. Synthesize prior disclosures before probing further.
2. Advance along the TQM phases: Step Mapping -> Friction Analysis -> 5 Whys Root Cause -> Benchmark SOP Comparison -> PDCA Synthesis.
3. Append the required JSON metadata block with 3 tailored suggestedQuickReplies reflecting your exact latest question.`,
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
            text: `Understood. I am ready to conduct a structured Total Quality Management (TQM) process audit for "${processName}" at Priority Risk Management. I will maintain active workflow memory, avoid repetition, probe root causes using 5 Whys, and synthesize PDCA continuous improvements with tailored quick replies.`,
          },
        ],
      },
    ];

    // Add prior conversation messages
    for (const msg of messages) {
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // Add current user input if present
    if (sanitizedText) {
      contents.push({
        role: 'user',
        parts: [{ text: sanitizedText }],
      });
    }

    // Call Gemini with resilient model fallback protocol
    const result = await generateContentWithFallback({
      contents,
      systemInstruction,
      temperature: 0.3,
    });

    // Parse the response using our dynamic quick prompt extractor
    const { cleanReply, meta } = parseQuickPromptsFromResponse(
      result.text,
      department,
      processName,
      messages.length
    );

    return NextResponse.json({
      reply: cleanReply,
      meta,
      warnings,
      modelUsed: result.modelUsed,
      attempts: result.attempts,
    });
  } catch (err: any) {
    console.error('Audit Chat API Error:', err);
    return NextResponse.json(
      {
        error: 'Unable to complete quality audit reasoning turn.',
        details: err.message || String(err),
      },
      { status: 500 }
    );
  }
}
