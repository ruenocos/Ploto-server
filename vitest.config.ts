import { configDefaults, defineConfig } from "vitest/config";

// Agent worktrees under .claude/ hold full copies of the repo; don't run their tests twice.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, ".claude/**"] },
});
