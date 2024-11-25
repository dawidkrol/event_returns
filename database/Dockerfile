FROM postgres:16.0

RUN apt-get update && apt-get install -y \
    postgresql-16-postgis-3 \
    postgresql-16-postgis-3-scripts \
    postgresql-server-dev-all \
    postgresql-16-pgrouting \
    osm2pgrouting \
    file \
    osmium-tool \
    wget \
    locales

RUN apt-get update && apt-get install -y locales && \
    echo "en_US.UTF-8 UTF-8" > /etc/locale.gen && \
    locale-gen

COPY init.sql /docker-entrypoint-initdb.d/init.sql

ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
ENV POSTGRES_DB=routing
