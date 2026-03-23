import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlacesModule } from './places/places.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PlacesModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
