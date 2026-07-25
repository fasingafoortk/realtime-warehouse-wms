import { Response, NextFunction } from 'express';
import { Warehouse } from './warehouse.model';
import { Zone } from './zone.model';
import { Bin } from './bin.model';
import { NotFoundError, ConflictError } from '../../errors/custom-errors';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { Types } from 'mongoose';

export class WarehouseController {
  // Warehouses
  public createWarehouse = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { code } = req.body;
      const existing = await Warehouse.findOne({ code });
      if (existing) {
        throw new ConflictError(`Warehouse with code '${code}' already exists.`);
      }

      const warehouse = new Warehouse(req.body);
      await warehouse.save();

      res.status(201).json(warehouse);
    } catch (error) {
      next(error);
    }
  };

  public listWarehouses = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await Warehouse.find().sort({ code: 1 });
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  };

  // Zones
  public createZone = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { warehouseId } = req.params;
      const { code } = req.body;

      const wh = await Warehouse.findById(warehouseId);
      if (!wh) {
        throw new NotFoundError(`Warehouse '${warehouseId}' not found.`);
      }

      const existing = await Zone.findOne({ warehouseId: new Types.ObjectId(warehouseId), code });
      if (existing) {
        throw new ConflictError(`Zone with code '${code}' already exists in this warehouse.`);
      }

      const zone = new Zone({
        ...req.body,
        warehouseId: new Types.ObjectId(warehouseId),
      });
      await zone.save();

      res.status(201).json(zone);
    } catch (error) {
      next(error);
    }
  };

  public listZones = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { warehouseId } = req.params;
      const data = await Zone.find({ warehouseId: new Types.ObjectId(warehouseId) }).sort({ code: 1 });
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  };

  // Bins
  public createBin = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { warehouseId, zoneId } = req.params;
      const { code } = req.body;

      const zone = await Zone.findOne({ _id: new Types.ObjectId(zoneId), warehouseId: new Types.ObjectId(warehouseId) });
      if (!zone) {
        throw new NotFoundError(`Zone '${zoneId}' not found in warehouse '${warehouseId}'.`);
      }

      const existing = await Bin.findOne({
        warehouseId: new Types.ObjectId(warehouseId),
        zoneId: new Types.ObjectId(zoneId),
        code,
      });

      if (existing) {
        throw new ConflictError(`Bin '${code}' already exists in this zone.`);
      }

      const bin = new Bin({
        ...req.body,
        warehouseId: new Types.ObjectId(warehouseId),
        zoneId: new Types.ObjectId(zoneId),
      });
      await bin.save();

      res.status(201).json(bin);
    } catch (error) {
      next(error);
    }
  };

  public listBins = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { warehouseId, zoneId } = req.params;
      const query: any = { warehouseId: new Types.ObjectId(warehouseId) };
      if (zoneId) {
        query.zoneId = new Types.ObjectId(zoneId);
      }
      
      const data = await Bin.find(query).sort({ code: 1 });
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  };
}
export default WarehouseController;
