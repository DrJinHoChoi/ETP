import { Params } from 'nestjs-pino';

export function getLoggerConfig(): Params {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      transport: isProduction
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
      serializers: {
        req: (req: any) => ({
          method: req.method,
          url: req.url,
          userId: req.raw?.user?.id || req.raw?.user?.sub || 'anonymous',
        }),
        res: (res: any) => ({
          statusCode: res.statusCode,
        }),
      },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '***',
      },
      customProps: () => ({
        service: 'etp-backend',
      }),
    },
  };
}
