import { NestFactory } from '@nestjs/core';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HotWalletModule } from './hotwallet.module';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(HotWalletModule);
  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('HotWallet API')
    .setDescription('API documentation for the HotWallet')
    .setVersion('1.0')
    .build();

  app.enableCors();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(4123);
}
bootstrap();
