CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================
-- Tabela wydarzeń (Events)
-- ==========================================
CREATE TABLE Events (
    eventId UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eventName TEXT NOT NULL,
    eventDescription TEXT,
    longitude DECIMAL(9, 6) NOT NULL,
    latitude DECIMAL(9, 6) NOT NULL,
    eventDate TIMESTAMP NOT NULL
);

-- ==========================================
-- Tabela użytkowników (Users)
-- ==========================================
CREATE TABLE Users (
    userId UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personEmail TEXT NOT NULL UNIQUE,
    personName TEXT NOT NULL,
    eventId UUID REFERENCES Events(eventId) ON DELETE SET NULL
);

-- ==========================================
-- Tabela kierowców (Drivers)
-- ==========================================
CREATE TABLE Drivers (
    userId UUID PRIMARY KEY REFERENCES Users(userId) ON DELETE CASCADE,
    longitude DECIMAL(9, 6),
    latitude DECIMAL(9, 6),
    numberOfAvailableSeats INT NOT NULL CHECK (numberOfAvailableSeats > 0),
    numberOfAvailablePassengers INT NOT NULL DEFAULT 0,
    initialDepartureTime TIMESTAMP NOT NULL,
    finalDepartureTime TIMESTAMP NOT NULL
);

-- ==========================================
-- Tabela pasażerów (Passengers)
-- ==========================================
CREATE TABLE Passengers (
    userId UUID PRIMARY KEY REFERENCES Users(userId) ON DELETE CASCADE,
    longitude DECIMAL(9, 6),
    latitude DECIMAL(9, 6),
    numberOfPeople INT NOT NULL CHECK (numberOfPeople > 0),
    initialDepartureTime TIMESTAMP NOT NULL,
    finalDepartureTime TIMESTAMP NOT NULL,
    driverId UUID REFERENCES Drivers(userId) ON DELETE SET NULL
);

-- ==========================================
-- Blacklista kierowców i pasażerów
-- ==========================================
CREATE TABLE DriverPassengerBlacklist (
    driverId UUID REFERENCES Drivers(userId) ON DELETE CASCADE,
    passengerId UUID REFERENCES Passengers(userId) ON DELETE CASCADE,
    PRIMARY KEY (driverId, passengerId)
);

-- ==========================================
-- Tabela tras (EventRoads)
-- ==========================================
CREATE TABLE EventRoads (
    roadId UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_point GEOMETRY(Point, 4326) NOT NULL,
    end_point GEOMETRY(Point, 4326) NOT NULL,
    calculated_route GEOMETRY(LineString, 4326),
    length DECIMAL NOT NULL,
    travel_time INTERVAL NOT NULL
);

-- ==========================================
-- Tabela segmentów tras (RoadSegments)
-- ==========================================
CREATE TABLE RoadSegments (
    segmentId UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segmentHash TEXT UNIQUE NOT NULL,
    start_point GEOMETRY(Point, 4326) NOT NULL,
    end_point GEOMETRY(Point, 4326) NOT NULL,
    path_geometry GEOMETRY(LineString, 4326) NOT NULL,
    segment_length DECIMAL NOT NULL,
    travel_time INTERVAL NOT NULL
);

CREATE INDEX ON RoadSegments USING GIST (path_geometry);
CREATE INDEX ON RoadSegments USING GIST (start_point);
CREATE INDEX ON RoadSegments USING GIST (end_point);

-- ==========================================
-- Mapowanie tras na segmenty (RoadToSegment)
-- ==========================================
CREATE TABLE RoadToSegment (
    roadId UUID REFERENCES EventRoads(roadId) ON DELETE CASCADE,
    segmentId UUID REFERENCES RoadSegments(segmentId) ON DELETE CASCADE,
    segment_order INT NOT NULL,
    PRIMARY KEY (roadId, segmentId)
);

-- ==========================================
-- Tabela przypisania tras do użytkowników (UserRoads)
-- ==========================================
CREATE TABLE UserRoads (
    roadId UUID REFERENCES EventRoads(roadId) ON DELETE CASCADE,
    userId UUID REFERENCES Users(userId) ON DELETE CASCADE,
    PRIMARY KEY (roadId, userId)
);


-- ==========================================
-- Funkcja liczaca trasy (calculate_route)
-- ==========================================
CREATE OR REPLACE FUNCTION calculate_route(
    start_lon double precision, 
    start_lat double precision, 
    end_lon double precision, 
    end_lat double precision
)
RETURNS TABLE(seq integer, node bigint, edge bigint, cost double precision, agg_cost double precision, geom_way geometry) AS
$$
BEGIN
    RETURN QUERY
    SELECT pt.seq, pt.node, pt.edge, rd.cost, pt.agg_cost, rd.geom_way
    FROM pgr_dijkstra(
        'SELECT id, source, target, cost FROM pl_2po_4pgr',
        (SELECT source FROM pl_2po_4pgr as pl
         ORDER BY ST_Distance(
             ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326),
             ST_StartPoint(pl.geom_way),
             true
         ) ASC
         LIMIT 1),
        (SELECT source FROM pl_2po_4pgr as pl
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
-- Funkcja liczaca hash trasy (calculate_segment_hash)
-- ==========================================
CREATE OR REPLACE FUNCTION calculate_segment_hash(
    start_lon DOUBLE PRECISION,
    start_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION
) RETURNS TEXT AS $$
DECLARE
    segment_hash TEXT;
BEGIN
    SELECT encode(digest(
        start_lon::TEXT || start_lat::TEXT || end_lon::TEXT || end_lat::TEXT,
        'sha256'
    ), 'hex') INTO segment_hash;

    RETURN segment_hash;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Funkcja sprawdzajaca istnienie segmentu (check_existing_segment)
-- ==========================================
CREATE OR REPLACE FUNCTION check_existing_segment(
    start_lon DOUBLE PRECISION,
    start_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION
) RETURNS UUID AS
$$
DECLARE
    segment_hash TEXT;
    existing_segment_uuid UUID;
BEGIN
    segment_hash := calculate_segment_hash(start_lon, start_lat, end_lon, end_lat);

    SELECT segmentId INTO existing_segment_uuid
    FROM RoadSegments
    WHERE segment_hash = segment_hash
    LIMIT 1;

    IF FOUND THEN
        RETURN existing_segment_uuid;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Funkcja pobierajaca lub tworzaca segment drogi (get_or_create_road)
-- ==========================================
CREATE OR REPLACE FUNCTION get_or_create_road(
    start_lon DOUBLE PRECISION,
    start_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION
) RETURNS TABLE(
    segmentId UUID,
    start_point GEOMETRY(Point, 4326),
    end_point GEOMETRY(Point, 4326),
    path_geometry GEOMETRY(LineString, 4326),
    segment_length DECIMAL,
    travel_time INTERVAL
) AS
$$
DECLARE
    new_segment_uuid UUID;
    path_geometry GEOMETRY(LineString, 4326);
    segment_length DECIMAL;
    travel_time_in_seconds DECIMAL;
    travel_time INTERVAL;
BEGIN
    new_segment_uuid := check_existing_segment(start_lon, start_lat, end_lon, end_lat);

    IF new_segment_uuid IS NOT NULL THEN
        RETURN QUERY
        SELECT
            segmentId,
            start_point,
            end_point,
            path_geometry,
            segment_length,
            travel_time
        FROM RoadSegments
        WHERE segmentId = new_segment_uuid;
    ELSE
        WITH route AS (
            SELECT 
                geom_way,
                cost
            FROM calculate_route(start_lon, start_lat, end_lon, end_lat) AS r
        )
        SELECT 
            ST_LineMerge(ST_Union(geom_way)) AS path_geometry,
            ST_Length(ST_Transform(ST_Union(geom_way), 4326)) AS segment_length,
            SUM(cost) AS travel_time_in_seconds
        INTO path_geometry, segment_length, travel_time_in_seconds
        FROM route;


        travel_time := make_interval(secs := travel_time_in_seconds);

        new_segment_uuid := gen_random_uuid();
        
        BEGIN
            INSERT INTO RoadSegments (
                segmentId, 
                segmentHash, 
                start_point, 
                end_point, 
                path_geometry, 
                segment_length, 
                travel_time
            )
            VALUES (
                new_segment_uuid,
                calculate_segment_hash(start_lon, start_lat, end_lon, end_lat),
                ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326),
                ST_SetSRID(ST_MakePoint(end_lon, end_lat), 4326),
                path_geometry,
                segment_length,
                travel_time
            );
        EXCEPTION WHEN unique_violation THEN
            RETURN QUERY
            SELECT
                segmentId,
                start_point,
                end_point,
                path_geometry,
                segment_length,
                travel_time
            FROM RoadSegments
            WHERE segment_hash = calculate_segment_hash(start_lon, start_lat, end_lon, end_lat)
            LIMIT 1;
        END;
        RETURN QUERY SELECT
            new_segment_uuid,
            ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326) AS start_point,
            ST_SetSRID(ST_MakePoint(end_lon, end_lat), 4326) AS end_point,
            path_geometry,
            segment_length,
            travel_time;
    END IF;
END;
$$ LANGUAGE plpgsql;
