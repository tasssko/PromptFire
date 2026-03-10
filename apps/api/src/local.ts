import 'dotenv/config';
import { createServer } from 'node:http';
import { handleHttpRequest } from './server';

const port = Number(process.env.PORT ?? 3001);

createServer(async (req, res) => {
  const bodyChunks: Buffer[] = [];

  req.on('data', (chunk) => bodyChunks.push(chunk));
  req.on('end', async () => {
    const body = bodyChunks.length > 0 ? Buffer.concat(bodyChunks).toString('utf8') : undefined;

    const response = await handleHttpRequest({
      method: req.method ?? 'GET',
      path: req.url ?? '/',
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]),
      ),
      body,
    });

    res.statusCode = response.statusCode;
    Object.entries(response.headers).forEach(([key, value]) => res.setHeader(key, value));
    res.end(response.body);
  });
}).listen(port, () => {
  console.info(`PromptFire API listening on http://localhost:${port}`);
});
