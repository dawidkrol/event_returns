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
