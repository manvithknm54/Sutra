import "dotenv/config";
import { app } from "./app.js";

// Validate JWT secret before starting the server
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set and at least 32 characters.");
  process.exit(1);
}

// Configure server port
const port = process.env.PORT || 4000;

// Start Express server
app.listen(port, () => {
  console.log(`🚀 Sutra API running on port ${port}`);
});