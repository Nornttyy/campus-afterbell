#!/usr/bin/env node
/**
 * Dependency-free integrity audit for a static menu build.
 * Run: node qa/menu-audit.mjs [build-directory, defaults to dist]
 * This checks local references; it does not claim to test the rendered UI.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.argv[2] || path.join(defaultRoot, 'dist'));
const entry = path.join(root, 'index.html');
const failures = [];
const visited = new Set();
const external = new Set();
let checkedReferences = 0;

const fail = (file, message) => failures.push(`${path.relative(root, file) || '.'}: ${message}`);
const isExternal = value => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);
const textTypes = new Set(['.html', '.css', '.js', '.mjs', '.json', '.gltf']);

async function resolveReference(from, raw, kind = 'asset') {
  const value = raw.trim();
  if (!value || value.startsWith('#')) return;
  if (isExternal(value)) {
    if (/^https?:/i.test(value)) external.add(value);
    return;
  }
  if (kind === 'import' && !value.startsWith('.') && !value.startsWith('/')) return;
  let local;
  try { local = decodeURIComponent(value.split(/[?#]/, 1)[0]); }
  catch { fail(from, `Invalid URL encoding: ${value}`); return; }
  const resolved = path.resolve(value.startsWith('/') ? root : path.dirname(from), local.replace(/^\//, ''));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    fail(from, `Reference escapes the served directory: ${value}`);
    return;
  }
  checkedReferences += 1;
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) { fail(from, `Reference is not a file: ${value}`); return; }
    if (stat.size === 0) { fail(from, `Referenced file is empty: ${value}`); return; }
  } catch {
    fail(from, `Missing local ${kind}: ${value}`);
    return;
  }
  if (textTypes.has(path.extname(resolved).toLowerCase())) await inspect(resolved);
}

async function inspect(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const source = await fs.readFile(file, 'utf8');
  const extension = path.extname(file).toLowerCase();
  if (extension === '.html') {
    const ids = [...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(match => match[1]);
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
    for (const id of new Set(repeated)) fail(file, `Duplicate HTML id: ${id}`);
    for (const match of source.matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']*)["']/g)) {
      const ref = match[1];
      if (ref.startsWith('#') && ref.length > 1 && !ids.includes(ref.slice(1))) {
        fail(file, `Broken in-page link: ${ref}`);
      } else await resolveReference(file, ref);
    }
    for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!/\bsrc\s*=/.test(match[1]) && !/type\s*=\s*["'](?:importmap|application\/)/i.test(match[1])) {
        await inspectScripts(file, match[2]);
      }
    }
  }
  if (extension === '.css' || extension === '.html') {
    for (const match of source.matchAll(/url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*))\s*\)/g)) {
      await resolveReference(file, match[1] ?? match[2] ?? match[3]);
    }
  }
  if (extension === '.js' || extension === '.mjs') await inspectScripts(file, source);
  if (extension === '.gltf') {
    try {
      const gltf = JSON.parse(source);
      for (const object of [...(gltf.buffers || []), ...(gltf.images || [])]) {
        if (typeof object.uri === 'string') await resolveReference(file, object.uri);
      }
    } catch (error) { fail(file, `Invalid glTF JSON: ${error.message}`); }
  }
}

async function inspectScripts(file, source) {
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) {
    await resolveReference(file, match[1], 'import');
  }
  for (const match of source.matchAll(/new\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)) {
    await resolveReference(file, match[1]);
  }
}

try {
  const html = await fs.readFile(entry, 'utf8');
  if (!/<!doctype\s+html/i.test(html)) fail(entry, 'Missing HTML doctype.');
  if (!/<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title>/i.test(html)) fail(entry, 'Missing non-empty page title.');
  if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html)) fail(entry, 'Missing viewport metadata.');
  await inspect(entry);
} catch (error) {
  fail(entry, `Cannot read entry: ${error.message}`);
}

if (failures.length) {
  console.error(`FAIL — ${failures.length} integrity issue(s)\n${failures.map(item => `  • ${item}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`PASS — ${visited.size} source files inspected, ${checkedReferences} local references resolved.`);
}
if (external.size) console.log(`INFO — ${external.size} external URL(s) found; availability requires browser/network verification.`);
console.log('Scope: static file integrity only. Verify interaction, accessibility, responsive layout and 3D rendering in a browser.');
