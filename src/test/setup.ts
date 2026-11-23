import "@testing-library/jest-dom/vitest";
import dotenv from "dotenv";
import { assertSafeTestDatabaseUrl } from "@/db/db-safety";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

// Isolate Vitest onto the dedicated local test DB so running `pnpm test`
// never mutates a live Neon showcase or production branch configured in `.env.local`.
const safeTestDbUrl = assertSafeTestDatabaseUrl(process.env);
process.env.DATABASE_URL = safeTestDbUrl;
process.env.DATABASE_URL_UNPOOLED = safeTestDbUrl;
