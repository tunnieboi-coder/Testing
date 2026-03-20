import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initDb } from './db';
import { requireAuth } from './middleware/auth';

import authRouter from './routes/auth';
import businessProfileRouter from './routes/business-profile';
import changeLogRouter from './routes/changeLog';
import rolesRouter from './routes/roles';
import atoRouter from './routes/ato';
import settingsRouter from './routes/settings';
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

// Public routes — no auth required
app.use('/api/auth', authRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All routes below require authentication
app.use(requireAuth);

app.use('/api/business-profile', businessProfileRouter);
app.use('/api/change-log', changeLogRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/ato', atoRouter);
app.use('/api/settings', settingsRouter);
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

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 GRC Platform backend running on http://localhost:${PORT}`);
});

export default app;
