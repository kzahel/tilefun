import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** Vite serves source files as well as public assets. Gitignore is not an HTTP
 * access boundary. Deny every private runtime data root, including /@fs and
 * symlink/encoded paths, while allowing the separate committed public/data.
 */
export function privateDataDirectories(root = process.cwd()) {
  return [
    ...new Set(
      [
        "data",
        process.env.DATA_DIR,
        process.env.WORKSHOP_AUTH_DIR,
        process.env.WORKSHOP_DATA_DIR,
        process.env.ART_NOTES_DIR,
        process.env.INTERIOR_REVIEW_DIR,
        "test-results",
      ]
        .filter((s): s is string => !!s)
        .map((path) => resolve(root, path)),
    ),
  ];
}
export function privateDataPlugin(root = process.cwd()): Plugin {
  const directories = privateDataDirectories(root).flatMap((directory) => {
    try {
      return [directory, realpathSync(directory)];
    } catch {
      return [directory];
    }
  });
  const within = (path: string) =>
    directories.some((directory) => {
      const normalized = path.replaceAll("\\", "/"),
        base = directory.replaceAll("\\", "/");
      return normalized === base || normalized.startsWith(base + "/");
    });
  const real = (path: string) => {
    try {
      return realpathSync(path);
    } catch {
      return path;
    }
  };
  return {
    name: "private-runtime-files",
    enforce: "pre",
    config() {
      return {
        server: {
          fs: {
            deny: [
              ".env",
              ".env.*",
              "*.{crt,pem}",
              "**/.git/**",
              ...directories.flatMap((directory) => [
                directory.replaceAll("\\", "/") + "/**",
                real(directory).replaceAll("\\", "/") + "/**",
              ]),
            ],
          },
        },
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let path: string;
        try {
          path = decodeURIComponent(
            new URL(req.url ?? "/", "http://localhost").pathname,
          ).replaceAll("\\", "/");
        } catch {
          res.statusCode = 400;
          res.end("Invalid path");
          return;
        }
        if (path.startsWith("/tilefun/")) path = path.slice("/tilefun".length);
        const absolute = path.startsWith("/@fs/")
          ? resolve(path.slice(5))
          : resolve(root, "." + path);
        const publicFile = resolve(root, "public", "." + path);
        if (within(absolute) || within(real(absolute)) || within(real(publicFile))) {
          if (
            !path.startsWith("/@fs/") &&
            existsSync(publicFile) &&
            statSync(publicFile).isFile() &&
            !within(real(publicFile))
          ) {
            next();
            return;
          }
          res.statusCode = 403;
          res.setHeader("Cache-Control", "no-store");
          res.end("Private runtime files are not served");
          return;
        }
        next();
      });
    },
  };
}
