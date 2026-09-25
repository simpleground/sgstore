// Node module hooks so tests can import the project's TypeScript files
// (including the `@/…` path alias) without a build step. TypeScript is
// transpiled with the `typescript` package, like the check-*.cjs tests do.
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../..', import.meta.url));
const isFile = (file) => existsSync(file) && statSync(file).isFile();
const isProjectTs = (url) =>
  url.startsWith('file:') &&
  /\.tsx?$/.test(url) &&
  !url.includes('/node_modules/');

function findFile(base) {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
  ])
    if (isFile(candidate)) return candidate;
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let base = null;
  if (specifier.startsWith('@/')) base = path.join(root, specifier.slice(2));
  else if (
    /^\.\.?\//.test(specifier) &&
    context.parentURL &&
    isProjectTs(context.parentURL)
  )
    base = path.resolve(
      path.dirname(fileURLToPath(context.parentURL)),
      specifier,
    );
  const file = base && findFile(base);
  if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // Packages without an "exports" map (e.g. next/headers) need the .js
    // extension under Node's ESM rules; bundlers add it automatically.
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || /^[./]/.test(specifier))
      throw error;
    return nextResolve(`${specifier}.js`, context);
  }
}

export async function load(url, context, nextLoad) {
  if (!isProjectTs(url)) return nextLoad(url, context);
  const fileName = fileURLToPath(url);
  const { outputText } = ts.transpileModule(await readFile(fileName, 'utf8'), {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  return { format: 'module', source: outputText, shortCircuit: true };
}
