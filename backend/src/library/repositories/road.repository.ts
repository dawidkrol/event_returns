import { query } from "~/utils/db";
import { WithError } from "~/utils/utils.type";

export async function getRoadById(roadId: string): Promise<WithError<{road: { type: string; features: any }}, string>> {
    try {
        const result = await query(
            `SELECT
                ST_AsGeoJSON(path_geometry) AS geometry
            FROM road_segments
            WHERE segment_hash = (SELECT segment_hash FROM road_to_segment WHERE road_id = $1)
            `,
            [roadId]
        );
        const geoJSON = {
            type: "FeatureCollection",
            features: result.map((row: any) => ({
              type: "Feature",
              geometry: JSON.parse(row.geometry),
              properties: {
                roadId: roadId,
              },
            })),
          };
        return { road: geoJSON };

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}
