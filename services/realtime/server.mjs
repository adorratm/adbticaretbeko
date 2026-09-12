import { createServer } from "node:http";
import { Server } from "socket.io";

const port = Number(process.env.REALTIME_PORT || process.env.HTTP_ADDR?.replace(":", "") || 8102);
const secret = process.env.REALTIME_INTERNAL_SECRET || "adb-dev-realtime";

const httpServer = createServer((req, res) => {
  if (req.method === "GET" && req.url?.startsWith("/healthz")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/broadcast") {
    const auth = req.headers["x-internal-secret"];
    if (auth !== secret) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const event = payload.event || "notification";
        const data = payload.data || payload;
        const uid = String(payload.userId || "").trim();
        const isBroadcast =
          payload.broadcast === true || !uid || uid === "broadcast" || uid === "*" || uid === "__broadcast__";

        if (isBroadcast) {
          io.to("broadcast").emit(event, data);
          io.emit(event, data);
        } else {
          io.to(`user:${uid}`).emit(event, data);
          io.to("admins").emit(event, data);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, broadcast: isBroadcast, userId: uid || null }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
});

io.on("connection", (socket) => {
  const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
  const role = socket.handshake.auth?.role || socket.handshake.query?.role;
  // Her müşteri genel yayın odasına da girer
  socket.join("broadcast");
  if (userId) socket.join(`user:${userId}`);
  if (role === "admin" || role === "ADMIN" || role === "SUPER_ADMIN") socket.join("admins");
  socket.emit("connected", { ok: true, userId: userId || null });
});

httpServer.listen(port, () => {
  console.log(`[realtime] socket.io on :${port}`);
});
