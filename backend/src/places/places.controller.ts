import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('search')
  async search(@Query('q') q: string) {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException('검색어를 입력해주세요.');
    }
    return this.placesService.search(q.trim());
  }
}
