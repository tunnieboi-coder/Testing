import express from 'express';
import cors from 'cors';
import { initDb } from './db';

import dashboardRouter from './routes/dashboard';
import frameworksRouter from './routes/frameworks';
import controlsRouter from './routes/controls';
import risksRouter from './routes/risks';
import vendorsRouter from './routes/vendors';
import policiesRouter from './routes/policies';
import assetsRouter from './routes/assets';
import auditsRouter from './routes/audits';
import evidenceRouter from './routes/evidence';
import integrationsRouter from './routes/integrations';
import profileRouter from './routes/profile';
import reportingRouter from './routes/reporting';
import systemsRouter from './routes/systems';
import categorizationRouter from './routes/categorization';

initDb();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/dashboard', dashboardRouter);
app.use('/api/frameworks', frameworksRouter);
app.use('/api/controls', controlsRouter);
app.use('/api/risks', risksRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/policies', policiesRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/audits', auditsRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/reporting', reportingRouter);
app.use('/api/systems', systemsRouter);
app.use('/api/categorization', categorizationRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 GRC Platform backend running on http://localhost:${PORT}`);
});

export default app;
