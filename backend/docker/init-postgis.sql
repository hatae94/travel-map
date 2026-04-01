CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Spatial index for location-based filtering (ST_DWithin)
CREATE INDEX IF NOT EXISTS idx_places_geom_geography
  ON places USING gist ((geom::geography));
