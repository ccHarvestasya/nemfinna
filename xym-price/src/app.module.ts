import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: [`.env.${process.env.NODE_ENV}`, `.env`] })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
