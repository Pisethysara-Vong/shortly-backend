import 'dotenv/config'; // must be first line
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
// import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:4000', // must be exact origin, not '*'
    credentials: true, // this line is critical
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Server is running on http://${process.env.IP_ADDRESS || 'localhost'}:${process.env.PORT ?? 3000}`,
  );
}
bootstrap();
