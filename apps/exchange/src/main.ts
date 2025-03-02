import { NestFactory } from '@nestjs/core';
import { ExchangeModule } from './exchange.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import expressBasicAuth from 'express-basic-auth';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};


async function bootstrap() {
  const app = await NestFactory.create(ExchangeModule);

  app.enableCors();
  // Sometime after NestFactory add this to add HTTP Basic Auth
  app.use(
    ['/docs', '/docs-json'],
    expressBasicAuth({
      challenge: true,
      users: {
        [process.env.API_MANAGER || 'admin']: process.env.API_PASSWORD || 'password',
      },
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('Exchange API')
    .setDescription('The Exchange API description')
    .setVersion('1.0')
    .addTag('exchange')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.port ?? 3001);
}
bootstrap();
