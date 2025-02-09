import { NestFactory } from '@nestjs/core';
import { ExchangeModule } from './exchange.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};


async function bootstrap() {
  const app = await NestFactory.create(ExchangeModule);
  
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
