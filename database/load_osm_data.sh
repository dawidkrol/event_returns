#!/bin/bash

# Install required packages
echo "Installing dependencies..."
apt-get update && apt-get install -y \
    osm2pgrouting \
    wget \
    libpq-dev \
    file \
    osmctools

# Check if POSTGRES_DB is set
if [ -z "$POSTGRES_DB" ]; then
    echo "Error: POSTGRES_DB environment variable is not set."
    exit 1
fi

# Create .pgpass file with database credentials
echo "db:5432:$POSTGRES_DB:$POSTGRES_USER:$POSTGRES_PASSWORD" > ~/.pgpass
chmod 600 ~/.pgpass

echo "Downloading OSM file for Malopolska..."

# Download OSM file for Malopolska
wget -O /tmp/malopolskie-latest.osm.pbf http://download.geofabrik.de/europe/poland/malopolskie-latest.osm.pbf

# Check if the file was downloaded
if [ ! -f /tmp/malopolskie-latest.osm.pbf ]; then
    echo "OSM file download failed!"
    exit 1
fi

echo "Running osm2pgrouting to import OSM data into PostgreSQL..."
osmium tags-filter /tmp/malopolskie-latest.osm.pbf nwr/highway -o /tmp/filtered.osm.pbf

osmconvert /tmp/malopolskie-latest.osm.pbf -o=/tmp/malopolskie-latest.osm

# Run osm2pgrouting with authentication
osm2pgrouting -h db -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/malopolskie-latest.osm

if [ $? -ne 0 ]; then
    echo "Error: osm2pgrouting import failed."
    exit 1
fi

# Remove the downloaded OSM file after import
rm /tmp/malopolskie-latest.osm.pbf

echo "OSM data has been successfully loaded into PostgreSQL."
