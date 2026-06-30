import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

/**
 * Wraps successful responses in a consistent envelope: { success, data }.
 * Already-enveloped payloads (have `success` or `items`) pass through untouched.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && ('success' in data || 'items' in data)) {
          return data
        }
        return { success: true, data }
      }),
    )
  }
}
