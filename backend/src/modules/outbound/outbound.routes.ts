import { Router } from 'express';
import Joi from 'joi';
import { OutboundController } from './outbound.controller';
import { OutboundService } from './outbound.service';
import { inventoryService } from '../inventory/inventory.routes';
import { validate } from '../../middlewares/validation.middleware';
import { authenticateJWT, requireRole } from '../../middlewares/auth.middleware';

const router = Router();
const service = new OutboundService(inventoryService);
const controller = new OutboundController(service);

const createOrderSchema = Joi.object({
  customerName: Joi.string().required(),
  orderNumber: Joi.string().required(),
  items: Joi.array()
    .items(
      Joi.object({
        skuId: Joi.string().required(),
        quantityRequested: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required(),
});

const warehouseIdSchema = Joi.object({
  warehouseId: Joi.string().required(),
});

router.get('/', authenticateJWT, controller.list);
router.get('/:id', authenticateJWT, controller.getById);

router.post(
  '/',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager'),
  validate(createOrderSchema),
  controller.create
);

router.post(
  '/:id/reserve',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager', 'Picker'),
  validate(warehouseIdSchema),
  controller.reserve
);

router.post(
  '/:id/pick',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager', 'Picker'),
  controller.pick
);

router.post(
  '/:id/ship',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager', 'Picker'),
  validate(warehouseIdSchema),
  controller.ship
);

router.post(
  '/:id/cancel',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager', 'Picker'),
  validate(warehouseIdSchema),
  controller.cancel
);

export default router;
export { service as outboundService };
