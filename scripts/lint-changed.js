import { execSync } from "child_process";
import process from "process";

try {
  // Determine comparison target
  let target = "origin/main";
  
  if (process.env.GITHUB_BASE_REF) {
    target = `origin/${process.env.GITHUB_BASE_REF}`;
  } else {
    // Check if we are on main branch or if origin/main doesn't exist
    try {
      execSync("git rev-parse --verify origin/main", { stdio: "ignore" });
      const currentBranch = execSync("git branch --show-current").toString().trim();
      if (currentBranch === "main") {
        target = "HEAD~1";
      }
    } catch (e) {
      target = "HEAD~1";
    }
  }

  console.log(`[CI Lint] Comparing against: ${target}`);

  // Get list of changed files
  const cmd = `git diff --name-only --diff-filter=ACMR ${target}`;
  const filesOutput = execSync(cmd).toString().trim();
  
  if (!filesOutput) {
    console.log("[CI Lint] No files changed.");
    process.exit(0);
  }

  const files = filesOutput.split("\n")
    .map(f => f.trim())
    .filter(f => f.startsWith("server/") && f.endsWith(".ts"));

  if (files.length === 0) {
    console.log("[CI Lint] No server TypeScript files changed.");
    process.exit(0);
  }

  console.log(`[CI Lint] Linting ${files.length} changed server file(s):`);
  files.forEach(f => console.log(`  - ${f}`));

  // Run eslint on the changed files
  const filesList = files.join(" ");
  execSync(`npx eslint ${filesList}`, { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
  
  console.log("[CI Lint] Linting passed successfully.");
} catch (error) {
  console.error("[CI Lint] Linting failed.");
  process.exit(1);
}
