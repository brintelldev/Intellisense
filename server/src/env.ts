import { resolve } from "path";
import { fileURLToPath } from "url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const envPath = resolve(dir, "../../.env");

try {
  // @ts-ignore — process.loadEnvFile is available in Node 20.6+
  process.loadEnvFile(envPath);
} catch {
  // .env is optional in production (env vars injected externally)
}
