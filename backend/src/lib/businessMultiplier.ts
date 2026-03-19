import db from '../db';

/**
 * Computes the aggregate business risk multiplier.
 * Each "yes" answer contributes its individual multiplier via multiplication.
 * The result is capped at 4.0 to avoid absurdly inflated scores.
 */
export function getBusinessMultiplier(): number {
  const yesAnswers = db.prepare(
    `SELECT risk_multiplier FROM business_questions WHERE answer = 'yes'`
  ).all() as { risk_multiplier: number }[];

  if (yesAnswers.length === 0) return 1.0;

  const product = yesAnswers.reduce((acc, row) => acc * row.risk_multiplier, 1.0);
  return Math.min(4.0, Math.round(product * 100) / 100);
}
