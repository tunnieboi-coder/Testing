import Anthropic from '@anthropic-ai/sdk';
import db from '../db';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ReviewInput {
  evidenceTitle: string;
  evidenceDescription: string;
  evidenceType: string;
  controlIds: string[];
}

export interface AIReviewResult {
  confidence: number;          // 0–100
  verdict: 'satisfies' | 'partial' | 'insufficient' | 'unclear';
  summary: string;             // 1–2 sentence rationale
  gaps: string[];              // list of specific gaps found
}

/**
 * Asks Claude to assess whether the supplied evidence satisfies the linked controls.
 * Returns structured JSON with a confidence score and verdict.
 */
export async function reviewEvidence(input: ReviewInput): Promise<AIReviewResult> {
  // Fetch control details for context
  const controls = input.controlIds.length
    ? (db.prepare(
        `SELECT identifier, title, description FROM controls WHERE id IN (${input.controlIds.map(() => '?').join(',')})`
      ).all(...input.controlIds) as { identifier: string; title: string; description: string }[])
    : [];

  const controlsText = controls.length
    ? controls.map(c => `- ${c.identifier}: ${c.title}\n  ${c.description ?? ''}`).join('\n')
    : '(No specific controls linked — assess general adequacy)';

  const prompt = `You are a compliance auditor reviewing evidence artifacts for a GRC platform.

Evidence artifact:
  Title: ${input.evidenceTitle}
  Description: ${input.evidenceDescription || '(none provided)'}
  Type: ${input.evidenceType}

Controls this evidence is intended to satisfy:
${controlsText}

Evaluate whether this evidence sufficiently demonstrates compliance with the listed controls.

Respond with ONLY valid JSON matching this exact schema (no markdown, no explanation outside the JSON):
{
  "confidence": <integer 0-100>,
  "verdict": "<satisfies|partial|insufficient|unclear>",
  "summary": "<1-2 sentence assessment>",
  "gaps": ["<gap 1>", "<gap 2>"]
}

Scoring guide:
- 90-100 = evidence clearly and completely satisfies all controls
- 70-89  = evidence satisfies most requirements with minor gaps
- 40-69  = evidence is partially relevant but significant gaps exist
- 0-39   = evidence is insufficient or unrelated to the controls
- "unclear" verdict when there is not enough information to assess`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text.trim();

  // Strip any accidental markdown code fences
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = JSON.parse(json) as AIReviewResult;

  // Validate verdict
  const validVerdicts = ['satisfies', 'partial', 'insufficient', 'unclear'];
  if (!validVerdicts.includes(parsed.verdict)) parsed.verdict = 'unclear';
  parsed.confidence = Math.max(0, Math.min(100, Math.round(parsed.confidence)));
  parsed.gaps = Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 8) : [];

  return parsed;
}
