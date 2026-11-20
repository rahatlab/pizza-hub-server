import { Server as IOServer, type Socket } from "socket.io";
import { verifyToken, type TokenPayload } from "../lib/jwt.js";

/** Socket.io instance attached to the HTTP server (created in src/index.ts). */
let io: IOServer | null = null;

export function initSocket(server: import("node:http").Server): IOServer {
  if (io) return io;
  io = new IOServer(server, {
    cors: {
      origin: ["http://localhost:3000"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const payload = verifyToken(token);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user as TokenPayload;
    console.log(`🔌 Socket connected: ${user.email} (${socket.id})`);

    socket.on("join-item", (itemId: string) => {
      socket.join(`item:${itemId}`);
      console.log(`   joined room item:${itemId}`);
    });

    socket.on("leave-item", (itemId: string) => {
      socket.leave(`item:${itemId}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): IOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

/** Emit a new review to all clients in the item's room. */
export function emitNewReview(itemId: string, review: unknown): void {
  getIO().to(`item:${itemId}`).emit("new-review", { itemId, review });
}
