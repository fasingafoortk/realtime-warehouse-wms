import { Router } from 'express';
import Joi from 'joi';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { validate } from '../../middlewares/validation.middleware';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();
const authService = new AuthService();
const controller = new AuthController(authService);

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().required(),
  role: Joi.string().valid('Admin', 'Warehouse Manager', 'Picker', 'Auditor').required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/logout', authenticateJWT, controller.logout);

export default router;
