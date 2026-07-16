import "reflect-metadata";

import { ConsoleLogger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import express, { Request, Response } from "express";

import { AppModule } from "../src/app.module";
import { HttpExceptionFilter } from "../src/common/httpExceptionFilter";
import { ResponseInterceptor } from "../src/common/interceptor";
import { GoogleService } from "../src/google/google.service";

let cachedApp: express.Express | null = null;

async function bootstrap(): Promise<express.Express> {
  if (cachedApp) return cachedApp;

  const expressApp = express();

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    {
      logger: new ConsoleLogger({
        prefix: "Zoho-EOD",
      }),
    },
  );

  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>("NODE_ENV") ?? "DEV";

  app.setGlobalPrefix("api/v1");
  const cors = config.getOrThrow<string>("CORS").split(";");
  app.enableCors({
    origin: cors,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(app.get(GoogleService)));
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`Eod Reportor - (${nodeEnv})`)
    .setDescription("Eod Reportor  API Documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("/api/doc", app, document, {
    customCssUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui.min.css",
    customJs: [
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-bundle.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-standalone-preset.min.js",
    ],
  });

  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.init();

  cachedApp = expressApp;
  return cachedApp;
}

export default async function handler(req: Request, res: Response) {
  const app = await bootstrap();
  app(req, res);
}
