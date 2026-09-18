import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
export function dependency(name) {
  try { return require(name); }
  catch {
    const base = process.env.MAILWEAVE_NODE_MODULES || path.resolve(path.dirname(process.execPath), '..', 'node_modules');
    return require(path.join(base, name));
  }
}
