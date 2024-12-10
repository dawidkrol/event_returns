import { query } from "~/utils/db";
import { WithError } from "~/utils/utils.type";

export async function getTempRoadByUserId(userId: string): Promise<WithError<{road: { type: string; features: any }}, string>> {
    try {
        const result = await query(
            `SELECT ST_AsGeoJSON(fn_get_temp_route) AS geometry FROM fn_get_temp_route($1);
            `,
            [userId]
        );
        const geoJSON = {
          type: "FeatureCollection",
          features: result.map((row: any) => ({
            type: "Feature",
            geometry: JSON.parse(row.geometry),
            properties: {
              passengerId: userId,
            },
          })),
        };
      return { road: geoJSON };

  } catch (error: any) {
      console.error("Error executing query:", error);
      return { error: error.message };
  }
}

export async function addNewRouteProposition(
    segmentId_hash: string,
    newSegment_hash_1: string,
    newSegment_hash_2: string,
    passengerId: string
): Promise<WithError<{roadId: string}, string>> {
    try {
        const result = await query(
            `SELECT add_new_route_proposition($1, $2, $3, $4);
            `,
            [
              segmentId_hash, 
              newSegment_hash_1,
              newSegment_hash_2, 
              passengerId
            ]
        );
        return { roadId: result[0].add_new_route_proposition };

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}
