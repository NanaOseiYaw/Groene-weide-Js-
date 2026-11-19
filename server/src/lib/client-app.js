// Serves the built Vue frontend (client/dist) in production, from the same address as the API.
// In development Vite serves the frontend itself (npm run dev), so this does nothing when
// there is no build.
//
// The Vue router decides which page to show, so every page address (/, /reserveren, /admin, …)
// gets the same index.html. Addresses under /api and /uploads never do: an unknown API route
// must answer with a JSON 404, not with a web page.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

export function serveClientApp(app, folder) {
  const indexFile = path.join(folder, 'index.html');
  if (!fs.existsSync(indexFile)) return false;

  // Files in /assets have a content hash in their name, so the browser may keep them for a year.
  app.use('/assets', express.static(path.join(folder, 'assets'), { immutable: true, maxAge: '1y', index: false }));
  app.use(express.static(folder, { index: false, maxAge: '1d' }));

  app.use((req, res, next) => {
    const isPage = (req.method === 'GET' || req.method === 'HEAD')
      && !/^\/(api|uploads|assets)(\/|$)/.test(req.path)
      && !path.extname(req.path) // a missing file such as /favicon.ico gets a 404, not the web page
      && req.accepts('html');
    if (!isPage) return next();
    res.set('Cache-Control', 'no-cache'); // always check for a new version of the page itself
    // "root": only the part inside the build folder is checked, so the app also works when it
    // is installed in a folder whose path contains a dot folder (e.g. C:\…\.claude\…).
    res.sendFile('index.html', { root: folder });
  });
  return true;
}
