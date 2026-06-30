import { json } from 'body-parser'
import { Request } from 'express'

/**
 * Preserves the raw request body on `req.rawBody` for routes that need it
 * (e.g. webhook signature verification). Mounted in main.ts before json().
 */
export function RawBodyMiddleware() {
  return json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buffer: Buffer) => {
      if (buffer?.length) req.rawBody = buffer
    },
  })
}
