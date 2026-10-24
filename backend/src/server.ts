import { app } from "./app.js";

const configuredPort = process.env.PORT ?? "4000";
const port = Number(configuredPort);

if (
  !/^\d+$/.test(configuredPort) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = app.listen(port, () => {
  console.log(`RevenuePilot backend listening at http://localhost:${port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(`Backend could not start (${error.code ?? "unknown error"}).`);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    const timeout = setTimeout(() => process.exit(1), 5000);
    timeout.unref();
  });
}
