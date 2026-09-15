import { vi } from "vitest";

// `server-only` throws when imported outside a React Server Component bundle.
// Tests exercise server modules directly, so neutralise the guard.
vi.mock("server-only", () => ({}));
