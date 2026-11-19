// npm run dev — starts the API (port 3000) and the Vue dev server (port 5173) together.
// Open http://localhost:5173. Every line of output starts with [api] or [web].
// Ctrl+C stops both. If one of them stops, the other is stopped too.
import { spawn } from 'node:child_process';

const parts = [
  { label: '[api]', workspace: 'server' },
  { label: '[web]', workspace: 'client' },
];

const children = parts.map(({ label, workspace }) => {
  // One fixed command string (no user input), so the shell does not need separate arguments.
  const child = spawn(`npm run dev --workspace ${workspace}`, { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
  const print = (stream) => (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) stream.write(`${label} ${line}\n`);
  };
  child.stdout.on('data', print(process.stdout));
  child.stderr.on('data', print(process.stderr));
  child.on('exit', (code) => stopAll(code ?? 0));
  return child;
});

let stopping = false;
function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // On Windows "npm" runs in a shell with child processes of its own: stop the whole tree.
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
