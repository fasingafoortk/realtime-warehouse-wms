import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ValidationError } from '../errors/custom-errors';

export const validate = (schema: Schema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true, // Strips unvalidated fields for safety
    });

    if (error) {
      const invalidParams = error.details.map((detail) => ({
        name: detail.path.join('.'),
        reason: detail.message,
      }));
      throw new ValidationError(invalidParams, 'Input validation failed.');
    }

    req[source] = value;
    next();
  };
};
export default validate;
