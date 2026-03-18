import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PlacesService implements OnModuleInit, OnModuleDestroy {
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

  async search(q: string) {
    const keyword = `%${q}%`;
    const { rows } = await this.pool.query(
      `SELECT
         osm_id,
         name,
         name_ko,
         name_en,
         category,
         type,
         phone,
         addr_full,
         addr_province,
         addr_city,
         addr_district,
         addr_suburb,
         addr_street,
         addr_housenumber,
         ST_X(geom) AS longitude,
         ST_Y(geom) AS latitude
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
