import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors } from '@vinejs/vine'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    const err: any = error

    // Centralized handling for Vine validation errors with field-level details
    if (err?.code === 'E_VALIDATION_ERROR' || (err && errors && err instanceof errors.E_VALIDATION_ERROR)) {
      const fields = Array.isArray(err.errors)
        ? err.errors.map((e: any) => ({ field: e.field, message: e.message, rule: e.rule }))
        : []

      const messages = typeof err.messages === 'function' ? err.messages() : err.messages

      return ctx.response.status(422).send({
        message: 'Validation failed',
        errors: messages || {},
        fields,
      })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
