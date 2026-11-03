import fs from "node:fs";
import path from "node:path";

/**
 * Resolves symlinks. A path that does not exist yet is resolved from its deepest existing ancestor.
 */
export function canonicalPath(target: string): string {
  const abs = path.resolve(target);
  try {
    return fs.realpathSync(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  if (fs.lstatSync(abs, { throwIfNoEntry: false })) {
    throw new Error(`Refusing dangling symlink: ${abs}`);
  }
  const parent = path.dirname(abs);
  return parent === abs ? abs : path.join(canonicalPath(parent), path.basename(abs));
}
