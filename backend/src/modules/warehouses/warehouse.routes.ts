import { Router } from 'express';
import Joi from 'joi';
import { WarehouseController } from './warehouse.controller';
import { validate } from '../../middlewares/validation.middleware';
import { authenticateJWT, requireRole } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new WarehouseController();

const warehouseSchema = Joi.object({
  code: Joi.string().uppercase().required(),
  name: Joi.string().required(),
  address: Joi.string().required(),
});

const zoneSchema = Joi.object({
  code: Joi.string().uppercase().required(),
  name: Joi.string().required(),
  allowedCategories: Joi.array().items(Joi.string()).optional(),
});

const binSchema = Joi.object({
  code: Joi.string().uppercase().required(),
  maxVolume: Joi.number().min(1).optional(),
  maxWeight: Joi.number().min(1).optional(),
  isReceivingDock: Joi.boolean().optional(),
});

router.get('/', authenticateJWT, controller.listWarehouses);
router.post(
  '/',
  authenticateJWT,
  requireRole('Admin'),
  validate(warehouseSchema),
  controller.createWarehouse
);

router.get('/:warehouseId/zones', authenticateJWT, controller.listZones);
router.post(
  '/:warehouseId/zones',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager'),
  validate(zoneSchema),
  controller.createZone
);

router.get('/:warehouseId/bins', authenticateJWT, controller.listBins);
router.get('/:warehouseId/zones/:zoneId/bins', authenticateJWT, controller.listBins);
router.post(
  '/:warehouseId/zones/:zoneId/bins',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager'),
  validate(binSchema),
  controller.createBin
);

export default router;
