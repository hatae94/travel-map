import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('lat') latStr?: string,
    @Query('lng') lngStr?: string,
  ) {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException('검색어를 입력해주세요.');
    }

    const location = this.parseLocation(latStr, lngStr);
    return this.placesService.search(q.trim(), location);
  }

  private parseLocation(
    latStr?: string,
    lngStr?: string,
  ): { lat: number; lng: number } | undefined {
    if (!latStr || !lngStr) return undefined;

    const lat = Number(latStr);
    const lng = Number(lngStr);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new BadRequestException('lat, lng는 유효한 숫자여야 합니다.');
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('lat/lng 범위가 유효하지 않습니다.');
    }

    return { lat, lng };
  }
}
