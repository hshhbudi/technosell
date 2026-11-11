import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startFast4TopWorker } from "../fast4topWorker";
import { readStoredMedia } from "../storage";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/media/:key", async (req, res) => {
    try {
      const key = decodeURIComponent(req.params.key);
      const media = await readStoredMedia(key);
      if (!media) return res.status(404).json({ error: "Media not found" });
      res.setHeader("Content-Type", media.contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(Buffer.from(media.dataBase64, "base64"));
    } catch (error) {
      console.error("[Media] Failed to read upload:", error);
      return res.status(500).json({ error: "Unable to load media" });
    }
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  console.log("[Fast4Top] Worker startup hook reached");
  try {
    startFast4TopWorker();
    console.log("[Fast4Top] Worker started; catalog sync was triggered");
  } catch (error) {
    console.error("[Fast4Top] Worker startup failed:", error instanceof Error ? error.message : error);
  }
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
