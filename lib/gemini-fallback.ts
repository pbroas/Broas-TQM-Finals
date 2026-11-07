import { GoogleGenAI } from '@google/genai';

/**
 * PRM Quality Intelligence: Resilient Gemini Model Fallback Protocol
 * Designed according to Section 6.A of the PRM Production Directives:
 * 1. Primary: gemini-3.6-flash
 * 2. High-Availability Fallback: gemini-3.1-flash-lite
 * 3. Dynamic Alias: gemini-flash-latest
 * 4. Deep Reasoning / Standard: gemini-3.7-flash (with fallbacks to gemini-2.5-flash)
 */

export interface ModelFallbackConfig {
  models?: string[];
  maxRetriesPerModel?: number;
  initialDelayMs?: number;
}

const DEFAULT_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-2.5-flash',
];

interface GenerateOptions {
  contents: any;
  systemInstruction?: string;
  temperature?: number;
  responseSchema?: any;
  responseMimeType?: string;
}

export interface FallbackResult {
  text: string;
  modelUsed: string;
  attempts: {
    model: string;
    attempt: number;
    success: boolean;
    error?: string;
  }[];
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecoverableError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const status = err.status || err.statusCode;
  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 404 ||
    msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('not found') ||
    msg.includes('overloaded')
  );
}

export async function generateContentWithFallback(
  options: GenerateOptions,
  config?: ModelFallbackConfig
): Promise<FallbackResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please verify Google Cloud Secret Manager or environment settings.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelLadder = config?.models || DEFAULT_FALLBACK_LADDER;
  const maxRetriesPerModel = config?.maxRetriesPerModel ?? 2;
  const initialDelayMs = config?.initialDelayMs ?? 400;

  const auditLog: FallbackResult['attempts'] = [];

  for (const model of modelLadder) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const generationConfig: any = {};
        if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
        if (options.responseMimeType) generationConfig.responseMimeType = options.responseMimeType;
        if (options.responseSchema) generationConfig.responseSchema = options.responseSchema;

        const requestPayload: any = {
          model,
          contents: options.contents,
        };

        if (options.systemInstruction) {
          requestPayload.config = {
            systemInstruction: options.systemInstruction,
            ...generationConfig,
          };
        } else if (Object.keys(generationConfig).length > 0) {
          requestPayload.config = generationConfig;
        }

        const response = await ai.models.generateContent(requestPayload);

        const textOutput = response.text || '';
        auditLog.push({
          model,
          attempt,
          success: true,
        });

        return {
          text: textOutput,
          modelUsed: model,
          attempts: auditLog,
        };
      } catch (error: any) {
        const errMsg = error?.message || String(error);
        auditLog.push({
          model,
          attempt,
          success: false,
          error: errMsg,
        });

        const canRetry = isRecoverableError(error) && attempt < maxRetriesPerModel;
        if (canRetry) {
          const backoff = initialDelayMs * Math.pow(2, attempt - 1);
          await wait(backoff);
        } else {
          // Break retry loop for this model and proceed to next fallback model in ladder
          break;
        }
      }
    }
  }

  const failureSummary = auditLog
    .map((a) => `[${a.model} - attempt ${a.attempt}: ${a.error || 'Failed'}]`)
    .join(', ');

  throw new Error(`All configured Gemini models in fallback ladder failed. Details: ${failureSummary}`);
}
