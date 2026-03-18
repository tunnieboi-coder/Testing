import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/', (req, res) => {
  const questions = db.prepare('SELECT * FROM technical_profile ORDER BY category, created_at').all();
  res.json(questions);
});

router.patch('/:id', (req, res) => {
  const { answer } = req.body;
  db.prepare("UPDATE technical_profile SET answer = ?, updated_at = datetime('now') WHERE id = ?").run(answer, req.params.id);

  const q = db.prepare('SELECT * FROM technical_profile WHERE id = ?').get(req.params.id) as { impact_controls: string } | undefined;
  if (!q) return res.status(404).json({ error: 'Not found' });

  res.json(db.prepare('SELECT * FROM technical_profile WHERE id = ?').get(req.params.id));
});

router.get('/recommendations', (req, res) => {
  const allQuestions = db.prepare('SELECT * FROM technical_profile').all() as Array<{
    id: string; question: string; answer: string | null; impact_controls: string; category: string;
  }>;

  const recommendations: Array<{
    controlId: string; identifier: string; title: string; reason: string; priority: string;
  }> = [];

  const noAnswers = allQuestions.filter(q => q.answer === 'no' || q.answer === null);

  for (const q of noAnswers) {
    let controlIds: string[] = [];
    try { controlIds = JSON.parse(q.impact_controls || '[]'); } catch { continue; }

    for (const identifier of controlIds) {
      const control = db.prepare(`
        SELECT c.id, c.identifier, c.title, c.status, c.priority FROM controls c WHERE c.identifier = ?
      `).get(identifier) as { id: string; identifier: string; title: string; status: string; priority: string } | undefined;

      if (control && control.status !== 'implemented') {
        recommendations.push({
          controlId: control.id,
          identifier: control.identifier,
          title: control.title,
          reason: `Based on your answer to: "${q.question}"`,
          priority: control.priority || 'P2',
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = recommendations.filter(r => {
    if (seen.has(r.controlId)) return false;
    seen.add(r.controlId);
    return true;
  });

  res.json(unique.slice(0, 20));
});

export default router;
