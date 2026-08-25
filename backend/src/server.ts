import { env } from "./config/env";
import { app } from "./app";
import { connectDatabase } from "./config/database";

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase();
    
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Backend server running on port ${env.PORT}`);
      console.log(`📊 Connected to MongoDB: InvoiceFlow`);
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
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
