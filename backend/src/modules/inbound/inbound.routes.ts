import { Router } from 'express';
import Joi from 'joi';
import { InboundController } from './inbound.controller';
import { InboundService } from './inbound.service';
import { inventoryService } from '../inventory/inventory.routes';
import { validate } from '../../middlewares/validation.middleware';
import { authenticateJWT, requireRole } from '../../middlewares/auth.middleware';

const router = Router();
const service = new InboundService(inventoryService);
const controller = new InboundController(service);

const createInboundSchema = Joi.object({
  supplierName: Joi.string().required(),
  referenceNumber: Joi.string().required(),
  items: Joi.array()
    .items(
      Joi.object({
        skuId: Joi.string().required(),
        quantityExpected: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required(),
});

const receiveInboundSchema = Joi.object({
  warehouseId: Joi.string().required(),
  items: Joi.array()
    .items(
      Joi.object({
        skuId: Joi.string().required(),
        quantityReceived: Joi.number().integer().min(0).required(),
      })
    )
    .min(1)
    .required(),
});

const putawayInboundSchema = Joi.object({
  warehouseId: Joi.string().required(),
  putawayInstructions: Joi.array()
    .items(
      Joi.object({
        skuId: Joi.string().required(),
        destinationBinId: Joi.string().required(),
      })
    )
    .min(1)
    .required(),
});

router.get('/', authenticateJWT, controller.list);
router.get('/:id', authenticateJWT, controller.getById);

router.post(
  '/',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager'),
  validate(createInboundSchema),
  controller.create
);

router.post(
  '/:id/receive',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager', 'Picker'),
  validate(receiveInboundSchema),
  controller.receive
);

router.post(
  '/:id/putaway',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager', 'Picker'),
  validate(putawayInboundSchema),
  controller.putaway
);

export default router;
