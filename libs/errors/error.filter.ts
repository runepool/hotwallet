import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { OracleError } from './errors';

@Catch(OracleError)
export class OracleErrorFilter implements ExceptionFilter {

  catch(exception: OracleError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    Logger.error(
      `Request failed, cause response: ${JSON.stringify(exception.getResponse())}`
    );

    response.status(status).json(exception.getResponse());
  }
}
