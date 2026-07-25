import { Response, NextFunction } from 'express';
import { OutboundService } from './outbound.service';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export class OutboundController {
  constructor(private outboundService: OutboundService) {}

  public create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const order = await this.outboundService.createOrder(req.body);
      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  };

  public getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const order = await this.outboundService.getOrderById(id);
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  };

  public list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const status = req.query.status as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.outboundService.listOrders({ status, page, limit });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public reserve = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { warehouseId } = req.body;

      const order = await this.outboundService.reserveOrder(id, warehouseId);
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  };

  public pick = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const pickerId = req.user!.id; // Picker who performs the action

      const order = await this.outboundService.pickOrder(id, pickerId);
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  };

  public ship = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { warehouseId } = req.body;
      const performedBy = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const order = await this.outboundService.shipOrder(
        id,
        warehouseId,
        performedBy,
        { ipAddress, userAgent }
      );

      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  };

  public cancel = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { warehouseId } = req.body;

      const order = await this.outboundService.cancelOrder(id, warehouseId);
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  };
}
export default OutboundController;
