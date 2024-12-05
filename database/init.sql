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
    driver_Id UUID REFERENCES drivers(user_id) ON DELETE CASCADE
);

-- ==========================================
-- Tabela segmentów tras (road_segments)
-- ==========================================
CREATE TABLE road_segments (
    segment_hash TEXT PRIMARY KEY,
    start_point GEOMETRY(Point, 4326) NOT NULL,
    end_point GEOMETRY(Point, 4326) NOT NULL,
    path_geometry GEOMETRY(LineString, 4326) NOT NULL,
    segment_length DECIMAL NULL,
    travel_time INTERVAL NULL
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
    previous_segment_hash text REFERENCES road_segments(segment_hash) ON DELETE CASCADE DEFAULT NULL,
    next_segment_hash text REFERENCES road_segments(segment_hash) ON DELETE CASCADE DEFAULT NULL,
    getting_of_userId UUID REFERENCES users(user_id) ON DELETE SET NULL,
    PRIMARY KEY (road_id, segment_hash)
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
    v_segment_hash TEXT;
    path_geometry GEOMETRY(LineString, 4326);
    segment_length DECIMAL;
    travel_time_in_seconds DECIMAL;
    travel_time INTERVAL;
BEGIN
    v_segment_hash := fn_check_existing_segment(start_lon, start_lat, end_lon, end_lat);

    IF v_segment_hash IS NOT NULL THEN
        RETURN QUERY
        SELECT
            rs.segment_hash,
            rs.start_point,
            rs.end_point,
            rs.path_geometry,
            rs.segment_length,
            rs.travel_time
        FROM road_segments rs
        WHERE rs.segment_hash = v_segment_hash;
    ELSE
        WITH route AS (
            SELECT 
                geom_way,
                cost
            FROM fn_calculate_route(start_lon, start_lat, end_lon, end_lat)
        )
        SELECT 
            ST_LineMerge(ST_Union(geom_way)) AS path_geometry,
            ST_Length(ST_Union(geom_way)) AS segment_length,
            SUM(cost) * 3600 AS travel_time_in_seconds
        INTO path_geometry, segment_length, travel_time_in_seconds
        FROM route;

        travel_time := make_interval(secs := travel_time_in_seconds);

        v_segment_hash := fn_calculate_segment_hash(start_lon, start_lat, end_lon, end_lat);

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
                v_segment_hash,
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
            WHERE rs.segment_hash = v_segment_hash
            LIMIT 1;
        END;

        RETURN QUERY SELECT
            v_segment_hash,
            ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326) AS start_point,
            ST_SetSRID(ST_MakePoint(end_lon, end_lat), 4326) AS end_point,
            path_geometry,
            segment_length,
            travel_time;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_create_event_road(
    driver_Id UUID
) RETURNS UUID AS
$$
DECLARE
    new_road_id UUID;
BEGIN
    INSERT INTO event_roads (road_id, driver_Id)
    VALUES (gen_random_uuid(), driver_Id)
    RETURNING event_roads.road_id INTO new_road_id;

    RETURN new_road_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_add_first_segment_to_road(
    v_road_id UUID
) RETURNS VOID AS
$$
DECLARE
    v_driver_Id UUID;
BEGIN
    SELECT driver_Id INTO v_driver_Id
    FROM event_roads
    WHERE event_roads.road_id = v_road_id;

    INSERT INTO road_to_segment (road_id, segment_hash, getting_of_userId)
    VALUES (
        v_road_id,
        (SELECT segment_hash FROM fn_get_or_create_road(
            (SELECT longitude FROM events WHERE event_id = (SELECT event_id FROM users WHERE user_id = (SELECT driver_Id FROM event_roads WHERE event_roads.road_id = v_road_id))),
            (SELECT latitude FROM events WHERE event_id = (SELECT event_id FROM users WHERE user_id = (SELECT driver_Id FROM event_roads WHERE event_roads.road_id = v_road_id))),
            (SELECT longitude FROM drivers WHERE user_id = v_driver_Id),
            (SELECT latitude FROM drivers WHERE user_id = v_driver_Id)
        )),
        v_driver_Id
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_get_passenger_route(
    v_passenger_id UUID
) RETURNS GEOMETRY AS
$$
DECLARE
    current_segment_hash TEXT;
    passenger_segment_hash TEXT;
    v_road_id UUID;
    aggregated_geometry GEOMETRY(LineString, 4326);
BEGIN
    SELECT road_id INTO v_road_id
    FROM road_to_segment
    WHERE getting_of_userId = v_passenger_id;

    SELECT segment_hash INTO passenger_segment_hash
    FROM road_to_segment
    WHERE road_id = v_road_id
      AND getting_of_userId = v_passenger_id;

    IF passenger_segment_hash IS NULL THEN
        RAISE EXCEPTION 'Passenger or their segment not found for the given road_id';
    END IF;

    SELECT segment_hash INTO current_segment_hash
    FROM road_to_segment
    WHERE road_id = v_road_id
      AND previous_segment_hash IS NULL;

    IF current_segment_hash IS NULL THEN
        RAISE EXCEPTION 'No starting segment found for the given road_id';
    END IF;

    aggregated_geometry := NULL;

    LOOP
        aggregated_geometry := 
            CASE 
                WHEN aggregated_geometry IS NULL THEN
                    (SELECT path_geometry FROM road_segments WHERE segment_hash = current_segment_hash)
                ELSE
                    ST_Union(aggregated_geometry, (SELECT path_geometry FROM road_segments WHERE segment_hash = current_segment_hash))
            END;

        IF current_segment_hash = passenger_segment_hash THEN
            EXIT;
        END IF;

        SELECT next_segment_hash INTO current_segment_hash
        FROM road_to_segment
        WHERE road_id = v_road_id
          AND segment_hash = current_segment_hash;

        IF current_segment_hash IS NULL THEN
            RAISE EXCEPTION 'Incomplete road structure: segment chain is broken before reaching passenger segment';
        END IF;
    END LOOP;

    RETURN aggregated_geometry;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_point_in_table(
    lon DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    tolerance DOUBLE PRECISION DEFAULT 0.0005
)
RETURNS BOOLEAN AS $$
DECLARE
    point_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pl_2po_4pgr
        WHERE ST_DWithin(
            geom_way,
            ST_SetSRID(ST_MakePoint(lon, lat), 4326),
            tolerance
        )
    )
    INTO point_exists;

    RETURN point_exists;
END;
$$ LANGUAGE plpgsql;
