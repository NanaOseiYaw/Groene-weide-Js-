// Security headers on every response.
//
// The Content-Security-Policy tells the browser to load scripts, styles, images and API calls
// only from this website itself. Even if someone managed to inject HTML into a page, the browser
// would refuse to run a script from elsewhere or send data to another website.
// That is why the frontend uses no CDNs, no Google Fonts and no inline <script> or style="…".
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff', // browsers must not guess file types
    'X-Frame-Options': 'DENY', // the site may not be shown inside another site's frame
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  next();
}
