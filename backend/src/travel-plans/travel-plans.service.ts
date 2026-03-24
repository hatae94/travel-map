import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Pool, types } from 'pg';

// DATE(1082) 타입을 문자열 그대로 반환 (타임존 변환 방지)
types.setTypeParser(1082, (val: string) => val);

@Injectable()
export class TravelPlansService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  onModuleInit() {
    this.pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'travel_map',
      user: process.env.PGUSER || 'travel',
      password: process.env.PGPASSWORD || 'travel',
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async create(userId: string, data: { title: string; description?: string; start_date?: string; end_date?: string }) {
    if (!data.title || data.title.trim().length === 0) {
      throw new BadRequestException('제목을 입력해주세요.');
    }
    const { rows } = await this.pool.query(
      `INSERT INTO travel_plans (user_id, title, description, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, description, start_date, end_date, created_at, updated_at`,
      [userId, data.title.trim(), data.description || null, data.start_date || null, data.end_date || null],
    );
    return this.formatRow(rows[0]);
  }

  async findAllByUser(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, title, description, start_date, end_date, created_at, updated_at
       FROM travel_plans WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((r) => this.formatRow(r));
  }

  async findOne(userId: string, planId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, title, description, start_date, end_date, created_at, updated_at
       FROM travel_plans WHERE id = $1 AND user_id = $2`,
      [planId, userId],
    );
    if (rows.length === 0) throw new NotFoundException('여행 계획을 찾을 수 없습니다.');
    const plan = this.formatRow(rows[0]);

    const { rows: items } = await this.pool.query(
      `SELECT id, place_node_id, memo, visit_order, visit_date, created_at
       FROM travel_plan_items WHERE plan_id = $1 ORDER BY visit_order`,
      [planId],
    );
    return { ...plan, items: items.map((i) => this.formatRow(i)) };
  }

  async update(userId: string, planId: string, data: { title?: string; description?: string; start_date?: string; end_date?: string }) {
    // 존재 확인
    await this.findOne(userId, planId);

    const fields: string[] = [];
    const values: (string | null)[] = [];
    let idx = 1;

    if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.start_date !== undefined) { fields.push(`start_date = $${idx++}`); values.push(data.start_date); }
    if (data.end_date !== undefined) { fields.push(`end_date = $${idx++}`); values.push(data.end_date); }
    fields.push(`updated_at = now()`);

    values.push(planId, userId);
    const { rows } = await this.pool.query(
      `UPDATE travel_plans SET ${fields.join(', ')}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING id, title, description, start_date, end_date, created_at, updated_at`,
      values,
    );
    return this.formatRow(rows[0]);
  }

  async remove(userId: string, planId: string) {
    await this.findOne(userId, planId);
    await this.pool.query('DELETE FROM travel_plans WHERE id = $1 AND user_id = $2', [planId, userId]);
    return { deleted: true };
  }

  // === Items ===

  async addItem(userId: string, planId: string, data: { place_node_id: number; memo?: string; visit_order?: number; visit_date?: string }) {
    await this.findOne(userId, planId);
    const { rows } = await this.pool.query(
      `INSERT INTO travel_plan_items (plan_id, place_node_id, memo, visit_order, visit_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, place_node_id, memo, visit_order, visit_date, created_at`,
      [planId, data.place_node_id, data.memo || null, data.visit_order || 0, data.visit_date || null],
    );
    return this.formatRow(rows[0]);
  }

  async removeItem(userId: string, planId: string, itemId: string) {
    await this.findOne(userId, planId);
    const { rowCount } = await this.pool.query(
      'DELETE FROM travel_plan_items WHERE id = $1 AND plan_id = $2',
      [itemId, planId],
    );
    if (rowCount === 0) throw new NotFoundException('아이템을 찾을 수 없습니다.');
    return { deleted: true };
  }

  private formatRow(row: Record<string, unknown>): Record<string, unknown> {
    if (typeof row['place_node_id'] === 'string') {
      row['place_node_id'] = Number(row['place_node_id']);
    }
    return row;
  }
}
