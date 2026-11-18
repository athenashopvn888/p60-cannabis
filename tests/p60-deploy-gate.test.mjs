import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  P60_PROJECT_ID,
  run,
  shouldIgnoreBuild,
} from "../scripts/vercel-ignore-p60-production.mjs";

const PNYS_PROJECT_ID = "prj_YxPnreV6iBh3AZIrTKKUK1z9tnuJ";

describe("p60-cannabis production deployment gate", () => {
  it("blocks an automatic p60-cannabis production build from main", () => {
    const env = {
      VERCEL_PROJECT_ID: P60_PROJECT_ID,
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "main",
    };

    assert.equal(shouldIgnoreBuild(env), true);
    assert.equal(run(env), 0);
  });

  it("allows p60-cannabis preview builds", () => {
    assert.equal(
      run({
        VERCEL_PROJECT_ID: P60_PROJECT_ID,
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "codex/test",
      }),
      1
    );
  });

  it("allows an explicit p60-cannabis production release without a Git branch ref", () => {
    assert.equal(
      run({
        VERCEL_PROJECT_ID: P60_PROJECT_ID,
        VERCEL_ENV: "production",
      }),
      1
    );
  });

  it("does not block pnys-pos production builds from the shared repository", () => {
    assert.equal(
      run({
        VERCEL_PROJECT_ID: PNYS_PROJECT_ID,
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
      1
    );
  });

  it("fails open if project identity is missing or unexpected", () => {
    assert.equal(
      run({
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
      1
    );
    assert.equal(
      run({
        VERCEL_PROJECT_ID: "prj_unknown",
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
      1
    );
  });
});
