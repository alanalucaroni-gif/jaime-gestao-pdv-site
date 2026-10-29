import { spawn } from 'node:child_process';
const mode = process.argv[2] ?? 'dev';
const commands = {
  dev: ['node_modules/tsx/dist/cli.mjs', 'watch', 'server/_core/index.ts'],
  start: ['dist/index.js'],
  static: ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', process.env.PORT || '3000', '--strictPort'],
};
if (!commands[mode]) throw new Error(`Modo desconhecido: ${mode}`);
const child = spawn(process.execPath, commands[mode], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: mode === 'start' ? 'production' : 'development', HOST: process.env.HOST || '127.0.0.1' },
});
child.on('exit', code => process.exit(code ?? 1));
child.on('error', error => { console.error(error); process.exit(1); });

