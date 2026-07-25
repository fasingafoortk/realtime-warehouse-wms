import { Router } from 'express';
import Joi from 'joi';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { validate } from '../../middlewares/validation.middleware';
import { authenticateJWT, requireRole } from '../../middlewares/auth.middleware';

const router = Router();
const service = new InventoryService();
const controller = new InventoryController(service);

const adjustmentSchema = Joi.object({
  warehouseId: Joi.string().required(),
  binId: Joi.string().required(),
  skuId: Joi.string().required(),
  quantity: Joi.number().min(0).required(),
  notes: Joi.string().allow('').optional(),
});

router.get('/', authenticateJWT, controller.getInventory);
router.get('/audit-logs', authenticateJWT, controller.getAuditLogs);
router.get('/putaway-suggestions', authenticateJWT, controller.getPutawaySuggestions);
router.post(
  '/adjust',
  authenticateJWT,
  requireRole('Admin'),
  validate(adjustmentSchema),
  controller.adjustStock
);

export default router;
export { service as inventoryService }; // Export service for use in other routes
