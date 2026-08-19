import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { corsOptions } from './origins';
import { verifyToken, JwtPayload } from '../utils/jwt';

let io: Server | null = null;

declare module 'socket.io' {
  interface Socket {
    user?: JwtPayload;
  }
}

/**
 * Reads the session from the handshake `auth` payload.
 *
 * The client passes the same bearer token it sends on HTTP requests, so the
 * socket authenticates from the same source of truth. It used to come from the
 * httpOnly cookie the browser attached automatically — see middleware/auth.ts
 * for why that is no longer possible.
 */
function userFromHandshake(auth: unknown): JwtPayload | null {
  const token = (auth as { token?: unknown } | undefined)?.token;
  if (typeof token !== 'string' || !token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    // The SAME allowlist the HTTP layer uses. Socket.IO is configured
    // separately, so a mismatch here fails silently: the app looks fine and
    // live order updates simply never arrive.
    cors: {
      origin: corsOptions.origin,
      // No credentials: the token travels in the handshake payload, not in a
      // cookie the browser attaches for us.
      credentials: false,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    socket.user = userFromHandshake(socket.handshake.auth) ?? undefined;
    // Unauthenticated sockets are allowed — customers tracking an order are
    // guests. Authorisation happens per-room below.
    next();
  });

  io.on('connection', (socket) => {
    // The admin firehose carries every customer's name, phone and address, so
    // joining it requires an actual admin session. Previously any client could
    // emit 'admin:join' and receive all of it.
    socket.on('admin:join', (ack?: (ok: boolean) => void) => {
      if (socket.user?.role !== 'admin') {
        ack?.(false);
        return;
      }
      socket.join('admins');
      ack?.(true);
    });

    // Per-order rooms stay open to guests: the order id is the capability, and
    // a guest who just checked out has no session to prove anything with.
    socket.on('order:subscribe', (orderId: unknown) => {
      if (typeof orderId === 'string' && /^VB-[A-Z0-9]{6}$/.test(orderId)) {
        socket.join(`order:${orderId}`);
      }
    });
    socket.on('order:unsubscribe', (orderId: unknown) => {
      if (typeof orderId === 'string') socket.leave(`order:${orderId}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

/** Notify all admins that a new order arrived. */
export function emitNewOrder(order: unknown): void {
  getIO().to('admins').emit('order:new', order);
}

/** Notify admins + the specific customer that an order's status changed. */
export function emitOrderStatus(order: { orderID: string } & Record<string, unknown>): void {
  getIO().to('admins').to(`order:${order.orderID}`).emit('order:status-updated', order);
}
