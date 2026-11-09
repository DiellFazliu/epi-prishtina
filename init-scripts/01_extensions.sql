-- Aktivizo extension-et e nevojshme
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verifiko
SELECT 'PostGIS version: ' || PostGIS_Version();
SELECT 'UUID extension: ' || extname FROM pg_extension WHERE extname = 'uuid-ossp';