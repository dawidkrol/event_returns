import { query } from "~/utils/db";
import { WithError } from "~/utils/utils.type";

export async function checkIfUserIsInTemporaryRoad(userId: string): Promise<{ isUserInTemporaryRoad: boolean }> {
    try {
        const result = await query(
            `SELECT * FROM temporary_road_to_segment WHERE getting_off_userid = $1;
            `,
            [userId]
        );
        return { isUserInTemporaryRoad: result.length > 0 };

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { isUserInTemporaryRoad: false };
    }
}

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
    passengerId: string,
    roadId: string
): Promise<WithError<{requestId: string}, string>> {
    try {
        const result = await query(
            `SELECT add_new_route_proposition($1, $2, $3, $4, $5);
            `,
            [
              segmentId_hash, 
              newSegment_hash_1,
              newSegment_hash_2, 
              passengerId, 
              roadId
            ]
        );
        console.log(result);
        return { requestId: result[0].add_new_route_proposition };

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function updateRouteProposition(
    roadId: string,
    segmentId_hash: string,
    newSegment_hash_1: string,
    newSegment_hash_2: string,
    passengerId: string
): Promise<WithError<{requestId: string}, string>> {
    try {
        const result = await query(
            `SELECT fn_update_route_proposition($1, $2, $3, $4, $5);
            `,
            [
              segmentId_hash, 
              newSegment_hash_1,
              newSegment_hash_2, 
              passengerId,
              roadId
            ]
        );
        return { requestId: result[0].fn_update_route_proposition };

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function getRoutePropositionRoadIdByRequestId(requestId: string): Promise<WithError<{roadId: string | null}, string>> {
    try {
        const result = await query(
            `SELECT road_id FROM temporary_road_to_segment WHERE request_id = $1;
            `,
            [requestId]
        );
        return { roadId: result[0]?.road_id || null };

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function getRoutePropositionByUserIdAndDriverId(requestId: string, driverId: string): Promise<WithError<{roadId: string | null}, string>> {
    try {
        const result = await query(
            `SELECT road_id FROM temporary_road_to_segment WHERE request_id = $1 AND driver_id = $2;
            `,
            [requestId, driverId]
        );
        return { roadId: result[0]?.road_id || null };

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function moveRoadFromTemporaryToFinal(requestId: string): Promise<void> {
    try {
        await query(
            `SELECT fn_move_road_from_temporary_to_final($1);
            `,
            [requestId]
        );

    } catch (error: any) {
        console.error("Error executing query:", error);
    }
}

export async function deleteRouteProposition(requestId: string): Promise<void> {
    try {
        await query(
            `SELECT fn_delete_road_from_temporary($1);
            `,
            [requestId]
        );

    } catch (error: any) {
        console.error("Error executing query:", error);
    }
}

export async function getPassengersIdByRequestId(requestId: string): Promise<{ passengerId: string[] }> {
    try {
        const result = await query(
            `SELECT DISTINCT modified_by_passenger_id FROM temporary_road_to_segment WHERE request_id = $1;
            `,
            [requestId]
        );
        return { passengerId: result.map((row: any) => row.modified_by_passenger_id) };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { passengerId: [] };
    }
}
