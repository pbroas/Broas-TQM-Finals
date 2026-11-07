import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback } from '@/lib/gemini-fallback';
import { sanitizeAndRedact } from '@/lib/security';
import { PRM_QUALITY_AUDIT_SYSTEM_PROMPT, formatAuditContextData } from '@/src/prompts/qualityAuditPrompt';

// Helper to calculate TQM phase from conversation depth
function determineTqmPhase(messageCount: number): string {
  if (messageCount <= 1) return 'process_identification';
  if (messageCount <= 3) return 'step_mapping';
  if (messageCount <= 5) return 'friction_analysis';
  if (messageCount <= 7) return 'root_cause';
  if (messageCount <= 9) return 'benchmark_comparison';
  return 'pdca_synthesis';
}

// Generates highly tailored, context-aware quick replies if AI skips or malforms JSON
function generateContextualQuickReplies(
  auditorText: string,
  department: string,
  processName: string,
  messageCount: number
): string[] {
  const textLower = auditorText.toLowerCase();

  // Scenario 1: Questions about systems, software, or tools (AMS360, AgencyZoom, portals)
  if (
    textLower.includes('ams360') ||
    textLower.includes('agencyzoom') ||
    textLower.includes('ringcentral') ||
    textLower.includes('portal') ||
    textLower.includes('tool') ||
    textLower.includes('system') ||
    textLower.includes('software')
  ) {
    return [
      'We log notes and suspense dates directly in AMS360.',
      'Carrier portals require manual duplicate re-entry of client data.',
      'AgencyZoom pipeline alerts trigger our follow-up tasks.',
    ];
  }

  // Scenario 2: Questions about delays, timeframes, turnaround, bottlenecks
  if (
    textLower.includes('delay') ||
    textLower.includes('turnaround') ||
    textLower.includes('how long') ||
    textLower.includes('bottleneck') ||
    textLower.includes('wait') ||
    textLower.includes('days') ||
    textLower.includes('time')
  ) {
    return [
      'Carrier underwriting responses average 3 to 5 business days.',
      'Waiting on insured client documents causes the longest delay.',
      'Peak season volume causes internal backlog during month-end.',
    ];
  }

  // Scenario 3: Questions about handoffs, department routing, or accountability
  if (
    textLower.includes('handoff') ||
    textLower.includes('transfer') ||
    textLower.includes('who') ||
    textLower.includes('responsib') ||
    textLower.includes('communicat') ||
    textLower.includes('routing')
  ) {
    return [
      'Handoffs happen via email without automated status tracking.',
      'Reception creates an AMS360 activity and alerts the specialist.',
      'Unclear task ownership occasionally causes requests to stall.',
    ];
  }

  // Scenario 4: Questions about standards, SOPs, checklists, or guidelines
  if (
    textLower.includes('standard') ||
    textLower.includes('sop') ||
    textLower.includes('checklist') ||
    textLower.includes('benchmark') ||
    textLower.includes('guideline') ||
    textLower.includes('procedure') ||
    textLower.includes('policy')
  ) {
    return [
      'We follow the standard PRM 45-day review timeline in AMS360.',
      'We lack a formal step-by-step checklist for this workflow.',
      'Custom client endorsements require non-standard manual steps.',
    ];
  }

  // Scenario 5: Questions about root causes, reasons, contributing factors (5 Whys)
  if (
    textLower.includes('why') ||
    textLower.includes('cause') ||
    textLower.includes('factor') ||
    textLower.includes('reason') ||
    textLower.includes('contribut') ||
    textLower.includes('underlying')
  ) {
    return [
      'Intake information is frequently incomplete upon initial receipt.',
      'High client inquiry volume limits time for thorough documentation.',
      'Lack of integration between systems forces duplicate manual work.',
    ];
  }

  // Scenario 6: Questions about improvement ideas, PDCA, corrective actions
  if (
    textLower.includes('improv') ||
    textLower.includes('recommend') ||
    textLower.includes('solution') ||
    textLower.includes('pdca') ||
    textLower.includes('prevent') ||
    textLower.includes('change') ||
    textLower.includes('action')
  ) {
    return [
      'Standardizing a client intake checklist would eliminate missing data.',
      'Automated email/SMS follow-up reminders would accelerate responses.',
      'Cross-training account specialists would balance peak workloads.',
    ];
  }

  // Scenario 7: Initial workflow sequence & triggers
  if (
    messageCount <= 2 ||
    textLower.includes('begin') ||
    textLower.includes('trigger') ||
    textLower.includes('start') ||
    textLower.includes('first step')
  ) {
    if (department.toLowerCase().includes('commercial')) {
      return [
        'Requests arrive via email and require checking certificate holder requirements.',
        'We review policy schedules and carrier limits in AMS360 first.',
        'Initial processing begins 60 days before commercial renewal expiration.',
      ];
    }
    if (department.toLowerCase().includes('sales') || department.toLowerCase().includes('advisor')) {
      return [
        'New leads are automatically routed and assigned in AgencyZoom.',
        'Initial discovery call is scheduled to collect risk profile and loss history.',
        'Quote preparation begins once all driver and property details are verified.',
      ];
    }
    return [
      'We pull the AMS360 expiration report 45 to 60 days in advance.',
      'We contact the insured by phone and follow up with a renewal review email.',
      'An inbound client service request or policy change triggers the workflow.',
    ];
  }

  // Fallback: Department and process specific
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
          readyForReport: Boolean(parsedMeta.readyForReport || messageCount >= 8),
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
      readyForReport: messageCount >= 8,
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
            text: `${dynamicAuditContext}\n\nPlease begin or continue our structured TQM quality audit interview in accordance with the PRM Quality Audit System Prompt. Remember to append the required JSON metadata block with 3 tailored suggestedQuickReplies reflecting your exact latest question.`,
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
            text: `Understood. I am ready to conduct a structured Total Quality Management (TQM) process audit for "${processName}" at Priority Risk Management in accordance with the PRM Quality Audit System Prompt.`,
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
