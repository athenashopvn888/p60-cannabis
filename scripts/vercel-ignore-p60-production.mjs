import { pathToFileURL } from "node:url";

export const P60_PROJECT_ID = "prj_xHATFV2xzK3nHSL5c8DrrBjktQzI";

export function shouldIgnoreBuild(env = process.env) {
  return (
    env.VERCEL_PROJECT_ID === P60_PROJECT_ID &&
    env.VERCEL_ENV === "production" &&
    env.VERCEL_GIT_COMMIT_REF === "main"
  );
}

export function run(env = process.env) {
  if (shouldIgnoreBuild(env)) {
    console.log(
      "Skipping automatic p60-cannabis production build from main. Use the reviewed explicit production release workflow."
    );
    return 0;
  }

  return 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(run());
}
