import { env } from "./config/env";
import { app } from "./app";

const server = app.listen(env.PORT, () => {
  console.log(`Backend server running on port ${env.PORT}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${env.PORT} is already in use. Stop the existing backend process or set PORT to another value in backend/.env.`
    );
    process.exit(1);
  }

  throw error;
});
