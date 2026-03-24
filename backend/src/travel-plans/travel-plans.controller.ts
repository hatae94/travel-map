import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TravelPlansService } from './travel-plans.service';

@Controller('travel-plans')
@UseGuards(JwtAuthGuard)
export class TravelPlansController {
  constructor(private readonly service: TravelPlansService) {}

  @Post()
  async create(@Req() req: { user: { id: string } }, @Body() body: { title: string; description?: string; start_date?: string; end_date?: string }) {
    return this.service.create(req.user.id, body);
  }

  @Get()
  async findAll(@Req() req: { user: { id: string } }) {
    return this.service.findAllByUser(req.user.id);
  }

  @Get(':id')
  async findOne(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.service.findOne(req.user.id, id);
  }

  @Patch(':id')
  async update(@Req() req: { user: { id: string } }, @Param('id') id: string, @Body() body: { title?: string; description?: string; start_date?: string; end_date?: string }) {
    return this.service.update(req.user.id, id, body);
  }

  @Delete(':id')
  async remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.service.remove(req.user.id, id);
  }

  @Post(':id/items')
  async addItem(@Req() req: { user: { id: string } }, @Param('id') id: string, @Body() body: { place_node_id: number; memo?: string; visit_order?: number; visit_date?: string }) {
    return this.service.addItem(req.user.id, id, body);
  }

  @Delete(':id/items/:itemId')
  async removeItem(@Req() req: { user: { id: string } }, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.removeItem(req.user.id, id, itemId);
  }
}
