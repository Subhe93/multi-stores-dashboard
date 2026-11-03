/**
 * Maps a failed multipart upload response to the error code the UI translates
 * (`errors.<code>`). Pure so it can be unit-tested without a DOM.
 *
 * nginx answers 413 *before* Node for bodies above `client_max_body_size`
 * (an HTML page, no JSON), and the API answers 413 with a coded JSON body
 * (`UPLOAD_FILE_TOO_LARGE`, `max_bytes`): both become the same code. Other
 * coded API errors keep their code; anything else falls back to the message.
 */
export const UPLOAD_FILE_TOO_LARGE = 'UPLOAD_FILE_TOO_LARGE';

export interface UploadFailure {
  code?: string;
  /** Server message (English), when the body was JSON. */
  message?: string;
  /** Known size cap in whole MB (from the body's `max_bytes`, else the caller's default). */
  maxMb?: number;
  status: number;
}

export function mapUploadFailure(
  status: number,
  json: Record<string, unknown> | null | undefined,
  defaultMaxBytes?: number,
): UploadFailure {
  const code = typeof json?.code === 'string' ? json.code : undefined;
  const rawMsg = json?.message;
  const message = Array.isArray(rawMsg)
    ? rawMsg.join(' · ')
    : typeof rawMsg === 'string'
      ? rawMsg
      : undefined;
  if (status === 413 || code === UPLOAD_FILE_TOO_LARGE) {
    const maxBytes =
      typeof json?.max_bytes === 'number' && json.max_bytes > 0 ? json.max_bytes : defaultMaxBytes;
    return {
      status,
      code: UPLOAD_FILE_TOO_LARGE,
      message,
      maxMb: maxBytes ? Math.round(maxBytes / (1024 * 1024)) : undefined,
    };
  }
  return { status, code, message };
}
