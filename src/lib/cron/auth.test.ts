import { afterEach, describe, expect, it, vi } from "vitest";
import { isCronAuthorised } from "./auth";

const request = (headers: Record<string, string>) =>
  new Request("http://localhost/api/cron/hearing-reminders", { headers });

describe("isCronAuthorised", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses everything when CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronAuthorised(request({ authorization: "Bearer " }))).toBe(false);
    expect(isCronAuthorised(request({}))).toBe(false);
  });

  it("accepts the bearer token or x-cron-secret header", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isCronAuthorised(request({ authorization: "Bearer s3cret" }))).toBe(true);
    expect(isCronAuthorised(request({ "x-cron-secret": "s3cret" }))).toBe(true);
  });

  it("rejects wrong or missing secrets", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isCronAuthorised(request({ authorization: "Bearer nope" }))).toBe(false);
    expect(isCronAuthorised(request({ authorization: "s3cret" }))).toBe(false);
    expect(isCronAuthorised(request({}))).toBe(false);
  });
});
