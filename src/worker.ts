import { Hono } from "hono";
import { renderHtml } from "./html";

export const createWorker = (appBundle: string): Hono => {
  const app = new Hono();

  app.get("/", (context) => context.html(renderHtml()));
  app.get("/app.js", (context) =>
    context.body(appBundle, 200, {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "text/javascript; charset=UTF-8",
      "X-Content-Type-Options": "nosniff",
    }),
  );
  app.get("/health", (context) =>
    context.json({ status: "ok", service: "uncall", phases: [0, 1] }),
  );
  app.notFound((context) => context.json({ error: "Not found" }, 404));

  return app;
};
