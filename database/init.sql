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
    path_geometry GEOMETRY(MultiLineString, 4326) NOT NULL,
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
    getting_off_userid UUID REFERENCES users(user_id) ON DELETE SET NULL,
    PRIMARY KEY (road_id, segment_hash)
);

-- ==========================================
-- Tabela tymczasowych tras (temporary_road_to_segment)
-- ==========================================
CREATE TABLE temporary_road_to_segment (
    road_id UUID REFERENCES event_roads(road_id) ON DELETE CASCADE,
    segment_hash text REFERENCES road_segments(segment_hash) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(user_id) ON DELETE CASCADE,
    previous_segment_hash text REFERENCES road_segments(segment_hash) ON DELETE CASCADE DEFAULT NULL,
    next_segment_hash text REFERENCES road_segments(segment_hash) ON DELETE CASCADE DEFAULT NULL,
    getting_off_userid UUID REFERENCES users(user_id) ON DELETE SET NULL,
    modified_by_passenger_id UUID NOT NULL REFERENCES passengers(user_id),
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    request_id UUID DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
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
    SELECT pt.seq, pt.node, pt.edge, rd.cost, pt.agg_cost, ST_Multi(rd.geom_way)
    FROM pgr_astar(
        'SELECT id, source, target, cost, reverse_cost, x1, y1, x2, y2 FROM pl_2po_4pgr',
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
        directed := true,
        heuristic := 2
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
    path_geometry GEOMETRY(MultiLineString, 4326),
    segment_length DECIMAL,
    travel_time INTERVAL
) AS
$$
DECLARE
    v_segment_hash TEXT;
    path_geometry GEOMETRY(MultiLineString, 4326);
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
            ST_Multi(rs.path_geometry)::GEOMETRY(MultiLineString, 4326) as path_geometry,
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
            ST_Multi(ST_Union(geom_way)) AS path_geometry,
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
                ST_Multi(path_geometry),
                segment_length,
                travel_time
            );
        EXCEPTION WHEN unique_violation THEN
            RETURN QUERY
            SELECT
                rs.segment_hash,
                rs.start_point,
                rs.end_point,
                ST_Multi(rs.path_geometry)::GEOMETRY(MultiLineString, 4326),
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
            ST_Multi(path_geometry)::GEOMETRY(MultiLineString, 4326),
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

    INSERT INTO road_to_segment (road_id, segment_hash, getting_off_userid)
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
    aggregated_geometry GEOMETRY(MultiLineString, 4326);
BEGIN
    SELECT road_id INTO v_road_id
    FROM road_to_segment
    WHERE getting_off_userid = v_passenger_id;

    SELECT segment_hash INTO passenger_segment_hash
    FROM road_to_segment
    WHERE road_id = v_road_id
      AND getting_off_userid = v_passenger_id;

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

    RETURN ST_Multi(aggregated_geometry)::GEOMETRY(MultiLineString, 4326);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_point_in_table(
    lon DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    tolerance DOUBLE PRECISION DEFAULT 1
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

CREATE OR REPLACE FUNCTION fn_find_nearest_driver_route_for_passenger(
    v_passenger_id UUID
) RETURNS TABLE (
    driver_id UUID,
    road_id UUID,
    nearest_distance DOUBLE PRECISION,
    nearest_segment_hash TEXT
) AS
$$
DECLARE
    v_passenger_geom GEOMETRY(Point, 4326);
    v_passanger_numberOfPeople INT;
    V_initialDepartureTime TIMESTAMP;
    V_finalDepartureTime TIMESTAMP;
    v_event_id UUID;
BEGIN
    SELECT event_id INTO v_event_id
    FROM users
    WHERE user_id = v_passenger_id;

    SELECT ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), number_of_people, initial_departure_time, final_departure_time
    INTO v_passenger_geom, v_passanger_numberOfPeople, V_initialDepartureTime, V_finalDepartureTime
    FROM passengers
    WHERE user_id = v_passenger_id;

    IF v_passenger_geom IS NULL THEN
        RAISE EXCEPTION 'Passenger ID % not found.', v_passenger_id;
    END IF;

    RETURN QUERY
    SELECT
        d.user_id AS driver_id,
        er.road_id AS road_id,
        ST_Distance(v_passenger_geom, rs.path_geometry) AS nearest_distance,
        rs.segment_hash AS nearest_segment_hash
    FROM drivers d
    JOIN event_roads er ON d.user_id = er.driver_id
    LEFT JOIN temporary_road_to_segment trts 
        ON er.road_id = trts.road_id
    LEFT JOIN road_to_segment rts 
        ON er.road_id = rts.road_id AND trts.segment_hash IS NULL
    JOIN road_segments rs 
        ON COALESCE(trts.segment_hash, rts.segment_hash) = rs.segment_hash
    JOIN users u 
        ON d.user_id = u.user_id
    WHERE u.event_id = v_event_id
    AND ST_DWithin(
        v_passenger_geom, 
        rs.path_geometry, 
        10000
    ) AND d.number_of_available_passengers >= v_passanger_numberOfPeople
    AND d.initial_departure_time <= V_initialDepartureTime
    AND d.final_departure_time >= V_finalDepartureTime
    ORDER BY ST_Distance(v_passenger_geom, rs.path_geometry)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_get_temp_route(
    v_passenger_id UUID
) RETURNS GEOMETRY AS
$$
DECLARE
    current_segment_hash TEXT;
    passenger_segment_hash TEXT;
    v_road_id UUID;
    aggregated_geometry GEOMETRY(MultiLineString, 4326);
BEGIN
    SELECT trs1.road_id INTO v_road_id
    FROM temporary_road_to_segment trs1
    WHERE getting_off_userid = v_passenger_id;

    SELECT trs2.segment_hash INTO passenger_segment_hash
    FROM temporary_road_to_segment trs2
    WHERE trs2.road_id = v_road_id
      AND getting_off_userid = v_passenger_id;

    IF passenger_segment_hash IS NULL THEN
        RAISE EXCEPTION 'Passenger or their segment not found for the given road_id';
    END IF;

    SELECT segment_hash INTO current_segment_hash
    FROM temporary_road_to_segment trs3
    WHERE trs3.road_id = v_road_id
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
                    ST_Union(
                        aggregated_geometry, 
                        (SELECT path_geometry FROM road_segments WHERE segment_hash = current_segment_hash)
                    )
            END;

        IF current_segment_hash = passenger_segment_hash THEN
            EXIT;
        END IF;


        SELECT next_segment_hash INTO current_segment_hash
        FROM temporary_road_to_segment trs4
        WHERE trs4.road_id = v_road_id
          AND trs4.segment_hash = current_segment_hash;

        IF current_segment_hash IS NULL THEN
            RAISE EXCEPTION 'Incomplete road structure: segment chain is broken before reaching passenger segment';
        END IF;
    END LOOP;

    RETURN ST_Multi(aggregated_geometry)::GEOMETRY(MultiLineString, 4326);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_extend_segment_with_passenger(
    v_passenger_id UUID,
    v_segment_id TEXT
) RETURNS TABLE (
    segment_hash TEXT,
    segment_length DECIMAL,
    travel_time INTERVAL,
	seq INT
) AS
$$
DECLARE
    v_segment_hash TEXT;
    v_previous_segment_hash TEXT;
    v_next_segment_hash TEXT;
    v_start_point GEOMETRY(Point, 4326);
    v_end_point GEOMETRY(Point, 4326);
    v_passenger_lon DOUBLE PRECISION;
    v_passenger_lat DOUBLE PRECISION;
BEGIN
    SELECT rs.start_point, rs.end_point
    INTO v_start_point, v_end_point
    FROM road_segments rs
    WHERE rs.segment_hash = v_segment_id;

    SELECT p.longitude, p.latitude
    INTO v_passenger_lon, v_passenger_lat
    FROM passengers p
    WHERE p.user_id = v_passenger_id;

    SELECT fn1.segment_hash into v_previous_segment_hash FROM fn_get_or_create_road(
        ST_X(v_start_point), ST_Y(v_start_point), v_passenger_lon, v_passenger_lat
    ) fn1;

    SELECT fn2.segment_hash into v_next_segment_hash FROM fn_get_or_create_road(
        v_passenger_lon, v_passenger_lat, ST_X(v_end_point), ST_Y(v_end_point)
    ) fn2;

    RETURN QUERY
    (SELECT
        rs.segment_hash,
        rs.segment_length,
        rs.travel_time,
        1 AS seq
    FROM road_segments rs
    WHERE rs.segment_hash = v_previous_segment_hash)
    UNION ALL
    (SELECT
        rs.segment_hash,
        rs.segment_length,
        rs.travel_time,
        2 AS seq
    FROM road_segments rs
    WHERE rs.segment_hash = v_next_segment_hash);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_new_route_proposition(
    v_segment_hash TEXT,
    v_new_segment_hash_1 TEXT,
    v_new_segment_hash_2 TEXT,
    v_passenger_id UUID,
    v_road_id UUID
) RETURNS UUID AS
$$
DECLARE
    org_next_segment_hash TEXT;
    org_previous_segment_hash TEXT;
    v_request_id UUID;
BEGIN
    SELECT next_segment_hash, previous_segment_hash
    INTO org_next_segment_hash, org_previous_segment_hash
    FROM road_to_segment
    WHERE segment_hash = v_segment_hash
      AND road_id = v_road_id;

    INSERT INTO temporary_road_to_segment (road_id, segment_hash, driver_id, previous_segment_hash, next_segment_hash, getting_off_userid, modified_by_passenger_id)
    VALUES (
        v_road_id,
        v_new_segment_hash_1,
        (SELECT driver_id FROM event_roads WHERE road_id = v_road_id LIMIT 1),
        (SELECT previous_segment_hash FROM road_to_segment WHERE segment_hash = v_segment_hash AND road_id = v_road_id),
        v_new_segment_hash_2,
        v_passenger_id,
        v_passenger_id
    );
    INSERT INTO temporary_road_to_segment (road_id, segment_hash, driver_id, previous_segment_hash, next_segment_hash, getting_off_userid, modified_by_passenger_id)
    VALUES (
        v_road_id,
        v_new_segment_hash_2,
        (SELECT driver_id FROM event_roads WHERE road_id = v_road_id LIMIT 1),
        v_new_segment_hash_1,
        (SELECT next_segment_hash FROM road_to_segment WHERE segment_hash = v_segment_hash AND road_id = v_road_id),
        (SELECT getting_off_userid FROM road_to_segment WHERE segment_hash = v_segment_hash AND road_id = v_road_id),
        v_passenger_id
    );

    INSERT INTO temporary_road_to_segment (road_id, segment_hash, previous_segment_hash, next_segment_hash, getting_off_userid)
    SELECT trs.road_id, trs.segment_hash, trs.previous_segment_hash, trs.next_segment_hash, trs.getting_off_userid
    FROM road_to_segment trs
    WHERE trs.road_id = v_road_id
      AND trs.segment_hash != v_segment_hash;

    IF org_previous_segment_hash IS NOT NULL THEN
        UPDATE temporary_road_to_segment
        SET next_segment_hash = v_new_segment_hash_1
        WHERE segment_hash = org_previous_segment_hash
          AND road_id = v_road_id;
    END IF;
    
    IF org_next_segment_hash IS NOT NULL THEN
        UPDATE temporary_road_to_segment
        SET previous_segment_hash = v_new_segment_hash_2
        WHERE segment_hash = org_next_segment_hash
          AND road_id = v_road_id;
    END IF;

    SELECT gen_random_uuid() INTO v_request_id;

    UPDATE temporary_road_to_segment
        SET request_id = v_request_id
        WHERE road_id = v_road_id;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_route_proposition(
    v_segment_hash TEXT,
    v_new_segment_hash_1 TEXT,
    v_new_segment_hash_2 TEXT,
    v_passenger_id UUID,
    v_road_id UUID
) RETURNS UUID AS
$$
DECLARE
    v_previous_segment_hash TEXT;
    v_next_segment_hash TEXT;
    v_request_id UUID;
BEGIN
    SELECT next_segment_hash, previous_segment_hash
    INTO v_next_segment_hash, v_previous_segment_hash
    FROM temporary_road_to_segment
    WHERE segment_hash = v_segment_hash
      AND road_id = v_road_id;

    INSERT INTO temporary_road_to_segment (road_id, segment_hash, driver_id, previous_segment_hash, next_segment_hash, getting_off_userid, modified_by_passenger_id)
    VALUES (
        v_road_id,
        v_new_segment_hash_1,
        (SELECT driver_id FROM event_roads WHERE road_id = v_road_id),
        (SELECT previous_segment_hash FROM temporary_road_to_segment WHERE segment_hash = v_segment_hash AND road_id = v_road_id),
        v_new_segment_hash_2,
        v_passenger_id,
        v_passenger_id
    );
    INSERT INTO temporary_road_to_segment (road_id, segment_hash, driver_id, previous_segment_hash, next_segment_hash, getting_off_userid, modified_by_passenger_id)
    VALUES (
        v_road_id,
        v_new_segment_hash_2,
        (SELECT driver_id FROM event_roads WHERE road_id = v_road_id),
        v_new_segment_hash_1,
        (SELECT next_segment_hash FROM temporary_road_to_segment WHERE segment_hash = v_segment_hash AND road_id = v_road_id),
        (SELECT getting_off_userid FROM temporary_road_to_segment WHERE segment_hash = v_segment_hash AND road_id = v_road_id),
        v_passenger_id
    );

    IF v_previous_segment_hash IS NOT NULL THEN
        UPDATE temporary_road_to_segment
        SET next_segment_hash = v_new_segment_hash_1
        WHERE segment_hash = v_previous_segment_hash
            AND road_id = v_road_id;
    END IF;
    
    IF v_next_segment_hash IS NOT NULL THEN
        UPDATE temporary_road_to_segment
        SET previous_segment_hash = v_new_segment_hash_2
        WHERE segment_hash = v_next_segment_hash
            AND road_id = v_road_id;
    END IF;

    DELETE FROM temporary_road_to_segment
    WHERE segment_hash = v_segment_hash
      AND road_id = v_road_id;

    SELECT gen_random_uuid() INTO v_request_id;

    UPDATE temporary_road_to_segment
        SET request_id = v_request_id
        WHERE road_id = v_road_id;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_move_road_from_temporary_to_final(
    v_request_id UUID
) RETURNS VOID AS
$$
DECLARE
    v_road_id UUID;
BEGIN
    SELECT road_id INTO v_road_id
    FROM temporary_road_to_segment
    WHERE request_id = v_request_id
    LIMIT 1;

    DELETE FROM road_to_segment
    WHERE road_id = v_road_id;

    INSERT INTO road_to_segment (road_id, segment_hash, previous_segment_hash, next_segment_hash, getting_off_userid)
    SELECT trts.road_id, trts.segment_hash, trts.previous_segment_hash, trts.next_segment_hash, trts.getting_off_userid
    FROM temporary_road_to_segment trts
    WHERE trts.road_id = v_road_id;

    DELETE FROM temporary_road_to_segment
    WHERE road_id = v_road_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_delete_road_from_temporary(
    v_request_id UUID
) RETURNS VOID AS
$$
BEGIN
    DELETE FROM fn_delete_road_from_temporary
    WHERE request_id = v_request_id;
END;
$$ LANGUAGE plpgsql;
