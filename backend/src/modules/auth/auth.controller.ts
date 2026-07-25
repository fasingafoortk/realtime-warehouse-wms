import { Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export class AuthController {
  constructor(private authService: AuthService) {}

  public register = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await this.authService.register({
        email: req.body.email,
        passwordHash: req.body.password, // plain password gets hashed in service
        name: req.body.name,
        role: req.body.role,
      });

      res.status(201).json({
        message: 'User registered successfully.',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public login = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.authService.login(req.body.email, req.body.password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.authService.refresh(req.body.refreshToken);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public logout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (userId) {
        await this.authService.logout(userId);
      }
      res.status(200).json({ message: 'Logged out successfully.' });
    } catch (error) {
      next(error);
    }
  };
}
export default AuthController;
