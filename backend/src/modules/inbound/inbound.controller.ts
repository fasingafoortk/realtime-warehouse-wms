import { Response, NextFunction } from 'express';
import { InboundService } from './inbound.service';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export class InboundController {
  constructor(private inboundService: InboundService) {}

  public create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const inbound = await this.inboundService.createInbound(req.body);
      res.status(201).json(inbound);
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
      const inbound = await this.inboundService.getInboundById(id);
      res.status(200).json(inbound);
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

      const result = await this.inboundService.listInbounds({ status, page, limit });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public receive = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { warehouseId, items } = req.body;
      const performedBy = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const inbound = await this.inboundService.receiveInbound(
        id,
        warehouseId,
        items,
        performedBy,
        { ipAddress, userAgent }
      );

      res.status(200).json(inbound);
    } catch (error) {
      next(error);
    }
  };

  public putaway = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { warehouseId, putawayInstructions } = req.body;
      const performedBy = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const inbound = await this.inboundService.putawayInbound(
        id,
        warehouseId,
        putawayInstructions,
        performedBy,
        { ipAddress, userAgent }
      );

      res.status(200).json(inbound);
    } catch (error) {
      next(error);
    }
  };
}
export default InboundController;
