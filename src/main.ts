import { ConsoleLogger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/httpExceptionFilter";
import { ResponseInterceptor } from "./common/interceptor";
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      prefix: "Zoho-EOD",
    }),
  });
  const config = app.get(ConfigService);

  const port = config.get<number>("PORT") ?? 3000;
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
  app.useGlobalFilters(new HttpExceptionFilter());
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`Eod Reportor - (${nodeEnv})`)
    .setDescription("Eod Reportor  API Documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("/api/doc", app, document);

  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.listen(port);
}
bootstrap();
