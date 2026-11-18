// Basic security headers on every response. A Content-Security-Policy is added
// in the phase where Express starts serving the Vue frontend.
export function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff', // browsers must not guess file types
    'X-Frame-Options': 'DENY', // the site may not be shown inside another site's frame
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  next();
}
