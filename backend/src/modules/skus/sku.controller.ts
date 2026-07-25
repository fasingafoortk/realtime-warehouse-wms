import { Response, NextFunction } from 'express';
import { SKU } from './sku.model';
import { NotFoundError, ConflictError } from '../../errors/custom-errors';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export class SKUController {
  public createSKU = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { code } = req.body;
      const existing = await SKU.findOne({ code });
      if (existing) {
        throw new ConflictError(`SKU with code '${code}' already exists.`);
      }

      const sku = new SKU(req.body);
      await sku.save();

      res.status(201).json(sku);
    } catch (error) {
      next(error);
    }
  };

  public getSKUById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const sku = await SKU.findById(id);
      if (!sku) {
        throw new NotFoundError(`SKU with ID '${id}' not found.`);
      }
      res.status(200).json(sku);
    } catch (error) {
      next(error);
    }
  };

  public listSKUs = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const category = req.query.category as string;
      const search = req.query.search as string;

      const skip = (page - 1) * limit;
      const query: any = {};

      if (category) query.category = category;
      if (search) {
        query.$or = [
          { code: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
        ];
      }

      const total = await SKU.countDocuments(query);
      const data = await SKU.find(query).skip(skip).limit(limit).sort({ code: 1 });

      res.status(200).json({
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public updateSKU = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const sku = await SKU.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
      if (!sku) {
        throw new NotFoundError(`SKU with ID '${id}' not found.`);
      }
      res.status(200).json(sku);
    } catch (error) {
      next(error);
    }
  };

  public deleteSKU = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const sku = await SKU.findByIdAndDelete(id);
      if (!sku) {
        throw new NotFoundError(`SKU with ID '${id}' not found.`);
      }
      res.status(200).json({ message: 'SKU deleted successfully.' });
    } catch (error) {
      next(error);
    }
  };
}
export default SKUController;
