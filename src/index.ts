import "dotenv/config";
import { startHttpServer } from "./server/http.js";
import { startStdioServer } from "./server/stdio.js";

const transport = process.env.TRANSPORT || "http";

if (transport === "stdio") {
  await startStdioServer();
} else {
  await startHttpServer();
}
