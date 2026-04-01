import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { EmbeddingService } from './embedding.service';
import { mergeMultipleWithRRF } from './rrf';

const SEARCH_LIMIT = 10;
const CANDIDATE_LIMIT = 20;
const VECTOR_SCORE_THRESHOLD = 0.85;
const NEARBY_RADIUS_METERS = 5000;

export interface LocationFilter {
  lat: number;
  lng: number;
}

@Injectable()
export class PlacesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlacesService.name);
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

  async search(q: string, location?: LocationFilter) {
    const searches: Promise<{ osm_id: number; name: string; score: number; [k: string]: unknown }[]>[] = [
      this.vectorSearch(q, location).catch((err) => {
        this.logger.warn(`Vector search failed: ${(err as Error).message}`);
        return [];
      }),
      this.trigramSearch(q, location).catch((err) => {
        this.logger.warn(`Keyword search failed: ${(err as Error).message}`);
        return [];
      }),
    ];

    if (location) {
      searches.push(
        this.spatialProximitySearch(q, location).catch((err) => {
          this.logger.warn(`Spatial search failed: ${(err as Error).message}`);
          return [];
        }),
      );
    }

    const rankedLists = await Promise.all(searches);
    return mergeMultipleWithRRF(rankedLists, SEARCH_LIMIT);
  }

  private async vectorSearch(q: string, location?: LocationFilter) {
    const queryEmbedding = await this.embeddingService.embed(q);
    const vecStr = `[${queryEmbedding.join(',')}]`;

    const spatialClause = location
      ? `AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, ${NEARBY_RADIUS_METERS})`
      : '';
    const params: (string | number)[] = [vecStr];
    if (location) {
      params.push(location.lng, location.lat);
    }

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
         ${spatialClause}
       ORDER BY name_embedding <=> $1::vector
       LIMIT ${CANDIDATE_LIMIT}`,
      params,
    );
    return rows.filter(
      (row: { score: number }) => row.score >= VECTOR_SCORE_THRESHOLD,
    );
  }

  private async trigramSearch(q: string, location?: LocationFilter) {
    const spatialClause = location
      ? `AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, ${NEARBY_RADIUS_METERS})`
      : '';
    const params: (string | number)[] = [q];
    if (location) {
      params.push(location.lng, location.lat);
    }

    const { rows } = await this.pool.query(
      `SELECT
         osm_id, name, name_ko, name_en, category, type,
         phone, addr_full, addr_province, addr_city,
         addr_district, addr_suburb, addr_street, addr_housenumber,
         ST_X(geom) AS longitude,
         ST_Y(geom) AS latitude,
         GREATEST(
           word_similarity($1, COALESCE(name, '')),
           word_similarity($1, COALESCE(name_ko, ''))
         )::float AS score
       FROM places
       WHERE ($1 <% name OR $1 <% name_ko)
         ${spatialClause}
       ORDER BY score DESC
       LIMIT ${CANDIDATE_LIMIT}`,
      params,
    );
    return rows;
  }

  private async spatialProximitySearch(q: string, location: LocationFilter) {
    const { rows } = await this.pool.query(
      `SELECT
         osm_id, name, name_ko, name_en, category, type,
         phone, addr_full, addr_province, addr_city,
         addr_district, addr_suburb, addr_street, addr_housenumber,
         ST_X(geom) AS longitude,
         ST_Y(geom) AS latitude,
         ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)::float AS distance_m,
         (1 - ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) / ${NEARBY_RADIUS_METERS})::float AS score
       FROM places
       WHERE ($1 <% name OR $1 <% name_ko)
         AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, ${NEARBY_RADIUS_METERS})
       ORDER BY geom::geography <-> ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
       LIMIT ${CANDIDATE_LIMIT}`,
      [q, location.lng, location.lat],
    );
    return rows;
  }
}
