import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

/** Mounts Swagger at config `swagger.path` unless disabled. Called from main.ts. */
export default function setupSwagger(app: INestApplication): void {
  const config = app.get(ConfigService)
  if (config.get<boolean>('swagger.enabled') === false) return

  const builder = new DocumentBuilder()
    .setTitle(config.get<string>('swagger.title'))
    .setDescription(config.get<string>('swagger.description'))
    .setVersion(config.get<string>('swagger.version'))
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, builder)
  SwaggerModule.setup(config.get<string>('swagger.path') || 'docs', app, document)
}
