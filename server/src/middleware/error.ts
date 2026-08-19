import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

const isProduction = process.env.NODE_ENV === 'production';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // A malformed ObjectId is a client mistake, not a server fault. Left as a
  // 500 it both misreports the failure and hands back a Mongoose message
  // naming the model and the path.
  if (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'CastError'
  ) {
    res.status(400).json({ error: 'Invalid identifier' });
    return;
  }

  // Mongo duplicate-key: a real client error, not a server fault. Reported
  // without echoing the offending value back.
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: 'That value is already taken' });
    return;
  }

  // Logged in full server-side; the response says nothing. A stack trace or a
  // raw driver message tells an attacker the framework, the schema and often
  // the query — none of which the client has any use for.
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    ...(isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
