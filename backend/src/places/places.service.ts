import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { EmbeddingService } from './embedding.service';

const SCORE_THRESHOLD = 0.3;

@Injectable()
export class PlacesService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private readonly embeddingService: EmbeddingService) {}

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

  async search(q: string) {
    try {
      return await this.vectorSearch(q);
    } catch {
      // 임베딩 모델 미로드 또는 벡터 없으면 ILIKE fallback
      return this.ilikeSearch(q);
    }
  }

  private async vectorSearch(q: string) {
    const queryEmbedding = await this.embeddingService.embed(q);
    const vecStr = `[${queryEmbedding.join(',')}]`;

    const { rows } = await this.pool.query(
      `SELECT
         osm_id, name, name_ko, name_en, category, type,
         phone, addr_full, addr_province, addr_city,
         addr_district, addr_suburb, addr_street, addr_housenumber,
         ST_X(geom) AS longitude,
         ST_Y(geom) AS latitude,
         (1 - (name_embedding <=> $1::vector))::float AS score
       FROM places
       WHERE name_embedding IS NOT NULL
         AND (1 - (name_embedding <=> $1::vector)) > $2
       ORDER BY name_embedding <=> $1::vector
       LIMIT 10`,
      [vecStr, SCORE_THRESHOLD],
    );
    return rows;
  }

  private async ilikeSearch(q: string) {
    const keyword = `%${q}%`;
    const { rows } = await this.pool.query(
      `SELECT
         osm_id, name, name_ko, name_en, category, type,
         phone, addr_full, addr_province, addr_city,
         addr_district, addr_suburb, addr_street, addr_housenumber,
         ST_X(geom) AS longitude,
         ST_Y(geom) AS latitude,
         1.0::float AS score
       FROM places
       WHERE name ILIKE $1
          OR name_ko ILIKE $1
          OR addr_full ILIKE $1
          OR addr_city ILIKE $1
       ORDER BY name
       LIMIT 10`,
      [keyword],
    );
    return rows;
  }
}
