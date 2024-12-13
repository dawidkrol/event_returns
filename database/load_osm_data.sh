#!/bin/bash

echo "Installing dependencies..."
apt-get update && apt-get install -y \
    wget \
    openjdk-11-jdk \
    unzip \
    postgresql \
    postgresql-client

if [ -z "$POSTGRES_DB" ] || [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_HOST" ]; then
    echo "Error: Required environment variables (POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST) are not set."
    exit 1
fi

echo "$POSTGRES_HOST:5432:$POSTGRES_DB:$POSTGRES_USER:$POSTGRES_PASSWORD" > ~/.pgpass
chmod 600 ~/.pgpass

OSM2PO_DIR="/opt/osm2po"
OSM2PO_ZIP_URL="http://osm2po.de/releases/osm2po-5.5.11.zip"

if [ ! -d "$OSM2PO_DIR" ]; then
    mkdir -p "$OSM2PO_DIR"
    wget -O "$OSM2PO_DIR/osm2po.zip" "$OSM2PO_ZIP_URL"
    unzip "$OSM2PO_DIR/osm2po.zip" -d "$OSM2PO_DIR"
    chmod +x "$OSM2PO_DIR/osm2po-core-5.5.11-signed.jar"
fi

if [ ! -f "$OSM2PO_DIR/osm2po-core-5.5.11-signed.jar" ]; then
    echo "Error: osm2po-core-5.5.11-signed.jar not found in $OSM2PO_DIR."
    exit 1
fi

echo "Processing OSM file..."
java -Xmx512m -jar "$OSM2PO_DIR/osm2po-core-5.5.11-signed.jar" \
    prefix=pl tileSize=x postp.0.class=de.cm.osm2po.plugins.postp.PgRoutingWriter \
    postp.0.pgTable=roads \
    http://download.geofabrik.de/europe/poland/malopolskie-latest.osm.pbf &

OSM2PO_PID=$!

echo "Waiting for osm2po to generate SQL file..."
while [ ! -f "/pl/pl_2po_4pgr.sql" ]; do
    sleep 15
done

kill $OSM2PO_PID

echo "Importing OSM data into PostgreSQL..."
PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "5432" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "/pl/pl_2po_4pgr.sql"

if [ $? -eq 0 ]; then
    echo "OSM data successfully imported."
    exit 0
else
    echo "Error: Failed to import OSM data."
    exit 1
fi
