import { Hono } from "hono";
import { renderHtml } from "./html";
import { renderQuantumHtml } from "./quantum/html";

const javascriptResponse = (bundle: string) => ({
  body: bundle,
  headers: {
    "Cache-Control": "public, max-age=300",
    "Content-Type": "text/javascript; charset=UTF-8",
    "X-Content-Type-Options": "nosniff",
  },
});

export const createWorker = (
  appBundle: string,
  quantumAppBundle = appBundle,
): Hono => {
  const app = new Hono();

  app.get("/", (context) => context.html(renderHtml()));
  app.get("/app.js", (context) => {
    const response = javascriptResponse(appBundle);
    return context.body(response.body, 200, response.headers);
  });
  app.get("/quantum", (context) => context.html(renderQuantumHtml()));
  app.get("/quantum/app.js", (context) => {
    const response = javascriptResponse(quantumAppBundle);
    return context.body(response.body, 200, response.headers);
  });
  app.get("/health", (context) =>
    context.json({ status: "ok", service: "uncall", phases: [0, 1, 2] }),
  );
  app.notFound((context) => context.json({ error: "Not found" }, 404));

  return app;
};
