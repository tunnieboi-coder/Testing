import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { validate } from '../middleware/validate';
import { getBusinessMultiplier } from '../lib/businessMultiplier';

const router = Router();

// GET /api/business-profile — list all questions with current answers
router.get('/', (req, res) => {
  const questions = db.prepare(
    'SELECT * FROM business_questions ORDER BY sort_order, category'
  ).all();
  const multiplier = getBusinessMultiplier();
  res.json({ questions, multiplier });
});

// GET /api/business-profile/multiplier — just the multiplier value
router.get('/multiplier', (req, res) => {
  res.json({ multiplier: getBusinessMultiplier() });
});

// PATCH /api/business-profile/:id — update a single question's answer
const AnswerSchema = z.object({
  answer: z.enum(['yes', 'no']).nullable(),
});

router.patch('/:id', validate(AnswerSchema), (req, res) => {
  const { answer } = req.body as z.infer<typeof AnswerSchema>;
  const q = db.prepare('SELECT id FROM business_questions WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Question not found' });

  db.prepare(
    `UPDATE business_questions SET answer = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(answer, req.params.id);

  const updated = db.prepare('SELECT * FROM business_questions WHERE id = ?').get(req.params.id);
  res.json({ question: updated, multiplier: getBusinessMultiplier() });
});

export default router;
