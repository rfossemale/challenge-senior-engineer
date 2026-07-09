import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  // OpenAPI / Swagger — served under the global prefix so both UI and JSON
  // sit alongside the rest of the API:
  //   Swagger UI:  http://localhost:3000/api/docs
  //   OpenAPI:     http://localhost:3000/api/docs-json
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TodoApi')
    .setDescription(
      'NestJS Todo REST API with bi-directional sync against an external Todo API. See AGENTS.md for architecture and conventions.',
    )
    .setVersion('1.0.0')
    .addTag('todo-lists', 'CRUD for TodoLists')
    .addTag('todo-items', 'CRUD for TodoItems nested under a specific TodoList')
    .addTag('sync', 'Bi-directional sync with the external Todo API')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(3000);
}

void bootstrap();
