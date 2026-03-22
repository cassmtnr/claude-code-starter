import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  shims: true,
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
