import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();
const service = new ReportsService();
const controller = new ReportsController(service);

router.get('/kpis', authenticateJWT, controller.getKPIs);

export default router;
