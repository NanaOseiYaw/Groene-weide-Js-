// Its own small file, so lib/errors.js can recognise it without loading the whole AI client.

/**
 * The AI service could not give a usable answer. The API answers 503 ai_unavailable (lib/errors.js).
 * reason: not_configured | timeout | network | http_<status> | bad_response
 */
export class AiUnavailableError extends Error {
  constructor(reason) {
    super(`AI service unavailable (${reason})`);
    this.reason = reason;
  }
}
