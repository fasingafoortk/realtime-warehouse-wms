import { Router } from 'express';
import Joi from 'joi';
import { SKUController } from './sku.controller';
import { validate } from '../../middlewares/validation.middleware';
import { authenticateJWT, requireRole } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new SKUController();

const skuSchema = Joi.object({
  code: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  category: Joi.string().required(),
  price: Joi.number().min(0).required(),
  reorderPoint: Joi.number().min(0).optional(),
  reorderQuantity: Joi.number().min(1).optional(),
  unitOfMeasure: Joi.string().optional(),
  weightPerUnit: Joi.number().min(0).optional(),
  volumePerUnit: Joi.number().min(0).optional(),
});

const skuUpdateSchema = skuSchema.fork(
  ['code', 'name', 'category', 'price'],
  (schema) => schema.optional()
);

router.get('/', authenticateJWT, controller.listSKUs);
router.get('/:id', authenticateJWT, controller.getSKUById);
router.post(
  '/',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager'),
  validate(skuSchema),
  controller.createSKU
);
router.put(
  '/:id',
  authenticateJWT,
  requireRole('Admin', 'Warehouse Manager'),
  validate(skuUpdateSchema),
  controller.updateSKU
);
router.delete(
  '/:id',
  authenticateJWT,
  requireRole('Admin'),
  controller.deleteSKU
);

export default router;
