export interface IValidationErrorParam {
  name: string;
  reason: string;
}

export class AppError extends Error {
  public readonly type: string;
  public readonly title: string;
  public readonly status: number;
  public readonly detail: string;
  public readonly invalidParams?: IValidationErrorParam[];

  constructor(
    status: number,
    title: string,
    detail: string,
    type = 'https://api.wms.com/errors/internal-error',
    invalidParams?: IValidationErrorParam[]
  ) {
    super(detail);
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type;
    this.invalidParams = invalidParams;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(detail: string, _instancePath?: string) {
    super(
      404,
      'Resource Not Found',
      detail,
      'https://api.wms.com/errors/not-found'
    );
  }
}

export class BadRequestError extends AppError {
  constructor(detail: string) {
    super(
      400,
      'Bad Request',
      detail,
      'https://api.wms.com/errors/bad-request'
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = 'Authentication is required to access this resource.') {
    super(
      401,
      'Unauthorized',
      detail,
      'https://api.wms.com/errors/unauthorized'
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = 'You do not have the required permissions to perform this action.') {
    super(
      403,
      'Forbidden',
      detail,
      'https://api.wms.com/errors/forbidden'
    );
  }
}

export class ConflictError extends AppError {
  constructor(detail: string) {
    super(
      409,
      'Conflict',
      detail,
      'https://api.wms.com/errors/conflict'
    );
  }
}

export class ValidationError extends AppError {
  constructor(invalidParams: IValidationErrorParam[], detail = 'Your request parameters did not validate.') {
    super(
      400,
      'Validation Failed',
      detail,
      'https://api.wms.com/errors/validation-failed',
      invalidParams
    );
  }
}

export class InsufficientStockError extends AppError {
  constructor(skuCode: string, requested: number, available: number, warehouseCode?: string) {
    const whDetail = warehouseCode ? ` in warehouse ${warehouseCode}` : '';
    super(
      409,
      'Insufficient Inventory Stock',
      `Requested ${requested} units of SKU ${skuCode}${whDetail}, but only ${available} units are available.`,
      'https://api.wms.com/errors/insufficient-stock',
      [
        {
          name: 'quantity',
          reason: `Available quantity (${available}) is less than requested (${requested}).`,
        },
      ]
    );
  }
}
