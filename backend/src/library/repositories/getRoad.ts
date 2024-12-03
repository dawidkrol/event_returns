import { query } from "~/utils/db";

export async function callDatabaseFunction(startLatitude: number, startLongitude: number, endLatitude: number, endLongitude: number) {
  try {
    const result = await query(
        `WITH route AS (
            SELECT travel_time, segment_length, path_geometry FROM fn_get_or_create_road($1, $2, $3, $4)
        )
        SELECT
            r.travel_time,
            r.segment_length,
            ST_AsGeoJSON(r.path_geometry) AS geometry
        FROM route r
        `,
        [startLatitude, startLongitude, endLatitude, endLongitude]
    );
    const geoJSON = {
        type: "FeatureCollection",
        features: result.map((row: any) => ({
          type: "Feature",
          geometry: JSON.parse(row.geometry),
          properties: {
            cost: row.travel_time,
          },
        })),
      };
    return geoJSON;
  } catch (err) {
    console.error("Error executing function:", err);
  }
};
