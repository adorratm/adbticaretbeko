import { createServer } from "node:http";
import { Server } from "socket.io";

const port = Number(process.env.REALTIME_PORT || process.env.HTTP_ADDR?.replace(":", "") || 8102);
const secret = process.env.REALTIME_INTERNAL_SECRET || "adb-dev-realtime";

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });
}

const httpServer = createServer(async (req, res) => {
  if (req.method === "GET" && req.url?.startsWith("/healthz")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const auth = req.headers["x-internal-secret"];

  if (req.method === "POST" && req.url === "/broadcast") {
    if (auth !== secret) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    try {
      const payload = await readJson(req);
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
    return;
  }

  if (req.method === "POST" && (req.url === "/job-event" || req.url === "/job-location" || req.url === "/job-status")) {
    if (auth !== secret) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    try {
      const payload = await readJson(req);
      const event = payload.event || (req.url === "/job-location" ? "job.location" : "job.status");
      const data = payload.data || payload;
      const teamId = String(data.teamId || "");
      const jobId = String(data.jobId || "");
      io.to("ops").emit(event, data);
      io.to("admins").emit(event, data);
      if (teamId) io.to(`team:${teamId}`).emit(event, data);
      if (jobId) io.to(`job:${jobId}`).emit(event, data);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, event }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
});

io.on("connection", (socket) => {
  const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
  const role = socket.handshake.auth?.role || socket.handshake.query?.role;
  const teamId = socket.handshake.auth?.teamId || socket.handshake.query?.teamId;
  socket.join("broadcast");
  if (userId) socket.join(`user:${userId}`);
  if (role === "admin" || role === "ADMIN" || role === "SUPER_ADMIN" || role === "ops") {
    socket.join("admins");
    socket.join("ops");
  }
  if (teamId) socket.join(`team:${teamId}`);
  socket.on("join", (room) => {
    if (typeof room === "string" && (room.startsWith("job:") || room.startsWith("team:") || room === "ops")) {
      socket.join(room);
    }
  });
  socket.emit("connected", { ok: true, userId: userId || null, teamId: teamId || null });
});

httpServer.listen(port, () => {
  console.log(`[realtime] socket.io on :${port}`);
});
