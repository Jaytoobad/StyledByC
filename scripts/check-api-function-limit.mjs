import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = fileURLToPath(new URL('../api/', import.meta.url));
const functionExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx']);

async function findFunctions(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const functions = [];

  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      functions.push(...await findFunctions(path));
    } else if (entry.isFile() && functionExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      functions.push(path);
    }
  }

  return functions;
}

const functions = await findFunctions(apiRoot);
console.log(`Vercel API functions: ${functions.length}/12`);
if (functions.length > 12) {
  console.error(`API function limit exceeded by ${functions.length - 12}:`);
  for (const path of functions) console.error(`  ${relative(apiRoot, path)}`);
  process.exitCode = 1;
}
