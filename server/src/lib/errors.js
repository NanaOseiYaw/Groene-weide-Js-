// Errors and the one place where they are turned into an HTTP response.
//
// Every error response has the same shape, so the frontend only needs one way to read it:
//   { "error": { "code": "spot_taken", "message": "Dutch text for the user", "fields": { ... } } }
// - code:    stable English identifier the frontend can check
// - message: short Dutch sentence that can be shown to the user as is
// - fields:  only for validation errors: Dutch message per form field

/** An error we expect and can explain to the user, e.g. "not found" or "invalid input". */
export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** For routes that do not exist. Mount it after all other routes. */
export function notFound(req, res, next) {
  next(new HttpError(404, 'not_found', 'Deze pagina of gegevens bestaan niet.'));
}

/**
 * Express error handler (it has four parameters, that is how Express recognises it).
 * Known errors keep their status and message. Unknown errors are logged in full on the server,
 * but the user only gets a general message, so no internal details leak out.
 */
export function errorHandler({ logger = console } = {}) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);

    const known = toHttpError(error);
    if (!known) {
      logger.error(`Unexpected error on ${req.method} ${req.originalUrl}:`, error);
    }
    const { status, code, message, fields } =
      known ?? new HttpError(500, 'server_error', 'Er ging iets mis op de server. Probeer het later opnieuw.');

    res.status(status).json({ error: fields ? { code, message, fields } : { code, message } });
  };
}

/** Errors from Express itself (e.g. invalid JSON) also get a clear Dutch message. */
function toHttpError(error) {
  if (error instanceof HttpError) return error;
  if (error?.type === 'entity.parse.failed') {
    return new HttpError(400, 'invalid_json', 'De gegevens konden niet worden gelezen.');
  }
  if (error?.type === 'entity.too.large') {
    return new HttpError(413, 'too_large', 'De gegevens zijn te groot.');
  }
  return null;
}
