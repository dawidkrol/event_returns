CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================
-- Tabela wydarzeń (events)
-- ==========================================
CREATE TABLE events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    event_description TEXT,
    longitude DECIMAL(9, 6) NOT NULL,
    latitude DECIMAL(9, 6) NOT NULL,
    event_date TIMESTAMP NOT NULL
);

-- ==========================================
-- Tabela użytkowników (users)
-- ==========================================
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_email TEXT NOT NULL,
    person_name TEXT NOT NULL,
    is_organizer BOOLEAN NOT NULL DEFAULT FALSE,
    event_id UUID REFERENCES events(event_id) ON DELETE SET NULL
);

ALTER TABLE IF EXISTS public.users
    ADD CONSTRAINT users_person_email_userID UNIQUE (person_email, user_id);

-- ==========================================
-- Tabela kierowców (drivers)
-- ==========================================
CREATE TABLE drivers (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    longitude DECIMAL(9, 6),
    latitude DECIMAL(9, 6),
    number_of_available_seats INT NOT NULL CHECK (number_of_available_seats > 0),
    number_of_available_passengers INT NOT NULL DEFAULT 0,
    initial_departure_time TIMESTAMP NOT NULL,
    final_departure_time TIMESTAMP NOT NULL
);

-- ==========================================
-- Tabela pasażerów (passengers)
-- ==========================================
CREATE TABLE passengers (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    longitude DECIMAL(9, 6),
    latitude DECIMAL(9, 6),
    number_of_people INT NOT NULL CHECK (number_of_people > 0),
    initial_departure_time TIMESTAMP NOT NULL,
    final_departure_time TIMESTAMP NOT NULL,
    driver_id UUID REFERENCES drivers(user_id) ON DELETE SET NULL
);

-- ==========================================
-- Blacklista kierowców i pasażerów
-- ==========================================
CREATE TABLE driver_passenger_blacklist (
    driver_id UUID REFERENCES drivers(user_id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES passengers(user_id) ON DELETE CASCADE,
    PRIMARY KEY (driver_id, passenger_id)
);

-- ==========================================
-- Tabela tras (event_roads)
-- ==========================================
CREATE TABLE event_roads (
    road_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_point GEOMETRY(Point, 4326) NOT NULL,
    end_point GEOMETRY(Point, 4326) NOT NULL,
    length DECIMAL NOT NULL,
    travel_time INTERVAL NOT NULL
);

-- ==========================================
-- Tabela segmentów tras (road_segments)
-- ==========================================
CREATE TABLE road_segments (
    segment_hash TEXT PRIMARY KEY,
    start_point GEOMETRY(Point, 4326) NOT NULL,
    end_point GEOMETRY(Point, 4326) NOT NULL,
    path_geometry GEOMETRY(LineString, 4326) NOT NULL,
    segment_length DECIMAL NOT NULL,
    travel_time INTERVAL NOT NULL
);

CREATE INDEX ON road_segments USING GIST (path_geometry);
CREATE INDEX ON road_segments USING GIST (start_point);
CREATE INDEX ON road_segments USING GIST (end_point);

-- ==========================================
-- Mapowanie tras na segmenty (road_to_segment)
-- ==========================================
CREATE TABLE road_to_segment (
    road_id UUID REFERENCES event_roads(road_id) ON DELETE CASCADE,
    segment_hash text REFERENCES road_segments(segment_hash) ON DELETE CASCADE,
    segment_order INT NOT NULL,
    PRIMARY KEY (road_id, segment_hash)
);

-- ==========================================
-- Tabela przypisania tras do użytkowników (user_roads)
-- ==========================================
CREATE TABLE user_roads (
    road_id UUID REFERENCES event_roads(road_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (road_id, user_id)
);

-- ==========================================
-- Funkcja licząca trasy (fn_calculate_route)
-- ==========================================
CREATE OR REPLACE FUNCTION fn_calculate_route(
    start_lon DOUBLE PRECISION, 
    start_lat DOUBLE PRECISION, 
    end_lon DOUBLE PRECISION, 
    end_lat DOUBLE PRECISION
)
RETURNS TABLE(seq INTEGER, node BIGINT, edge BIGINT, cost DOUBLE PRECISION, agg_cost DOUBLE PRECISION, geom_way GEOMETRY) AS
$$
BEGIN
    RETURN QUERY
    SELECT pt.seq, pt.node, pt.edge, rd.cost, pt.agg_cost, rd.geom_way
    FROM pgr_dijkstra(
        'SELECT id, source, target, cost FROM pl_2po_4pgr',
        (SELECT source FROM pl_2po_4pgr AS pl
         ORDER BY ST_Distance(
             ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326),
             ST_StartPoint(pl.geom_way),
             true
         ) ASC
         LIMIT 1),
        (SELECT source FROM pl_2po_4pgr AS pl
         ORDER BY ST_Distance(
             ST_SetSRID(ST_MakePoint(end_lon, end_lat), 4326),
             ST_StartPoint(pl.geom_way),
             true
         ) ASC
         LIMIT 1),
        directed := false
    ) AS pt
    JOIN pl_2po_4pgr rd ON pt.edge = rd.id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Funkcja licząca hash trasy (fn_calculate_segment_hash)
-- ==========================================
CREATE OR REPLACE FUNCTION fn_calculate_segment_hash(
    start_lon DOUBLE PRECISION,
    start_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION
) RETURNS TEXT AS $$ 
DECLARE 
    segment_hash TEXT; 
BEGIN 
    SELECT encode(digest(
        ROUND(start_lon::NUMERIC, 4)::TEXT || 
        ROUND(start_lat::NUMERIC, 4)::TEXT || 
        ROUND(end_lon::NUMERIC, 4)::TEXT || 
        ROUND(end_lat::NUMERIC, 4)::TEXT,
        'sha256'
    ), 'hex') INTO segment_hash;

    RETURN segment_hash; 
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Funkcja sprawdzająca istnienie segmentu (fn_check_existing_segment)
-- ==========================================
CREATE OR REPLACE FUNCTION fn_check_existing_segment(
    start_lon DOUBLE PRECISION,
    start_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION
) RETURNS TEXT AS
$$
DECLARE
    v_segment_hash TEXT;
    existing_segment_hash TEXT;
BEGIN
    v_segment_hash := fn_calculate_segment_hash(start_lon, start_lat, end_lon, end_lat);

    SELECT rs.segment_hash INTO existing_segment_hash
    FROM road_segments rs
    WHERE rs.segment_hash = v_segment_hash
    LIMIT 1;

    IF FOUND THEN
        RETURN existing_segment_hash;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Funkcja pobierająca lub tworząca segment drogi (fn_get_or_create_road)
-- ==========================================
CREATE OR REPLACE FUNCTION fn_get_or_create_road(
    start_lon DOUBLE PRECISION,
    start_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION
) RETURNS TABLE(
    segment_hash TEXT,
    start_point GEOMETRY(Point, 4326),
    end_point GEOMETRY(Point, 4326),
    path_geometry GEOMETRY(LineString, 4326),
    segment_length DECIMAL,
    travel_time INTERVAL
) AS
$$
DECLARE
    new_segment_hash TEXT;
    path_geometry GEOMETRY(LineString, 4326);
    segment_length DECIMAL;
    travel_time_in_seconds DECIMAL;
    travel_time INTERVAL;
BEGIN
    new_segment_hash := fn_check_existing_segment(start_lon, start_lat, end_lon, end_lat);

    IF new_segment_hash IS NOT NULL THEN
        RETURN QUERY
        SELECT
            rs.segment_hash,
            rs.start_point,
            rs.end_point,
            rs.path_geometry,
            rs.segment_length,
            rs.travel_time
        FROM road_segments rs
        WHERE rs.segment_hash = new_segment_hash;
    ELSE
        WITH route AS (
            SELECT 
                geom_way,
                cost
            FROM fn_calculate_route(start_lon, start_lat, end_lon, end_lat) AS r
        )
        SELECT 
            ST_LineMerge(ST_Union(geom_way)) AS path_geometry,
            ST_Length(ST_Union(geom_way)) AS segment_length,
            SUM(cost) * 3600 AS travel_time_in_seconds
        INTO path_geometry, segment_length, travel_time_in_seconds
        FROM route;

        travel_time := make_interval(secs := travel_time_in_seconds);

        new_segment_hash := fn_calculate_segment_hash(start_lon, start_lat, end_lon, end_lat);

        BEGIN
            INSERT INTO road_segments (
                segment_hash, 
                start_point, 
                end_point, 
                path_geometry, 
                segment_length, 
                travel_time
            )
            VALUES (
                new_segment_hash,
                ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326),
                ST_SetSRID(ST_MakePoint(end_lon, end_lat), 4326),
                path_geometry,
                segment_length,
                travel_time
            );
        EXCEPTION WHEN unique_violation THEN
            RETURN QUERY
            SELECT
                rs.segment_hash,
                rs.start_point,
                rs.end_point,
                rs.path_geometry,
                rs.segment_length,
                rs.travel_time
            FROM road_segments rs
            WHERE rs.segment_hash = new_segment_hash
            LIMIT 1;
        END;
        
        RETURN QUERY SELECT
            new_segment_hash,
            ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326) AS start_point,
            ST_SetSRID(ST_MakePoint(end_lon, end_lat), 4326) AS end_point,
            path_geometry,
            segment_length,
            travel_time;
    END IF;
END;
$$ LANGUAGE plpgsql;
