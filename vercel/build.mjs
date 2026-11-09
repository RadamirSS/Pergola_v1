import { cpSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(new URL('./public/', import.meta.url), { recursive: true });
cpSync(new URL('../public/', import.meta.url), new URL('./public/', import.meta.url), { recursive: true });
const built = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'build', '--webpack'], { cwd: here, stdio: 'inherit' });
if (built.error) throw built.error;
process.exit(built.status ?? 1);
