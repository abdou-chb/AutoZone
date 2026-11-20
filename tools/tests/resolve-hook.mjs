// Lets node load the app's Vite-style imports (no file extension) for these tests.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, next) {
    if ((specifier.startsWith(".") || specifier.startsWith("/")) && !/\.[cm]?jsx?$/.test(specifier)) {
      for (const ext of [".js", ".jsx"]) {
        const url = new URL(specifier + ext, context.parentURL);
        if (existsSync(fileURLToPath(url))) return next(url.href, context);
      }
    }
    return next(specifier, context);
  },
});
