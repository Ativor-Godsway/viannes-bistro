import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

/** Validate req.body against a Zod schema, replacing it with the parsed value. */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}
