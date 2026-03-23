import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { EmbeddingService } from './embedding.service';

@Module({
  controllers: [PlacesController],
  providers: [PlacesService, EmbeddingService],
})
export class PlacesModule {}
