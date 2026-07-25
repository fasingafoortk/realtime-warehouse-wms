import { Response, NextFunction } from 'express';
import { ReportsService } from './reports.service';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  public getKPIs = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const warehouseId = req.query.warehouseId as string;
      const kpis = await this.reportsService.getDashboardKPIs(warehouseId);
      res.status(200).json(kpis);
    } catch (error) {
      next(error);
    }
  };
}
export default ReportsController;
