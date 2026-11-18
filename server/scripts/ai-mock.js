// npm run ai:mock [-- --mode=slow|error|unavailable|bad]
// Starts the fake AI service (src/ai/mock-ai-service.js) on http://localhost:8000 (or AI_MOCK_PORT).
// Point the API at it with AI_SERVICE_URL=http://localhost:8000 in .env and restart npm run dev.
// When AI_SERVICE_KEY is set, the mock checks it like the real service would. Ctrl+C stops it.
import { loadEnvFile } from '../src/config.js';
import { MOCK_MODES, createMockAiService } from '../src/ai/mock-ai-service.js';

loadEnvFile();
const modeArgument = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArgument ? modeArgument.slice('--mode='.length) : 'ok';
if (!MOCK_MODES.includes(mode)) {
  console.error(`Unknown mode "${mode}". Choose one of: ${MOCK_MODES.join(', ')}.`);
  process.exit(1);
}
const port = Number(process.env.AI_MOCK_PORT || 8000);

const mock = createMockAiService({ key: process.env.AI_SERVICE_KEY ?? '', mode });
try {
  const url = await mock.listen(port, '127.0.0.1');
  console.log(`Fake AI service (mode: ${mode}) on ${url}${process.env.AI_SERVICE_KEY ? ', checks AI_SERVICE_KEY' : ''}`);
} catch (error) {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Set AI_MOCK_PORT to another port.` : error);
  process.exit(1);
}

const stop = () => mock.close().then(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
