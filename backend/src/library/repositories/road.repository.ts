import { RoadToSegment } from "~/models/road-to-segment.model";
import { Segment } from "~/models/segment.model";
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

export async function getRoadByUserId(userId: string): Promise<WithError<{road: { type: string; features: any }}, string>> {
    try {
        const result = await query(
            `SELECT ST_AsGeoJSON(fn_get_passenger_route) AS geometry FROM fn_get_passenger_route($1);
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

export async function checkIfPointIsAvailable(longitude: number, latitude: number): Promise<WithError<{isAvailable: boolean}, string>> {
    try {
        const result = await query(
            `SELECT check_point_in_table($1, $2) AS is_avaliable;
            `,
            [longitude, latitude]
        );
        return { isAvailable: result[0].is_avaliable };

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function findNearestDriversRoad(passengerId: string): Promise<WithError<{roadId: string, driverId: string}, string>> {
    try {
        const result = await query(
            `SELECT road_id, driver_id FROM fn_find_nearest_driver_route_for_passenger($1);
            `,
            [passengerId]
        );
        return { roadId: result[0].road_id, driverId: result[0].driver_id };

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function getRoadToSegmentsByRoadId(roadId: string): Promise<WithError<{ roadSegments: RoadToSegment[] }, string>> {
    try {
        const result = await query(
            `SELECT road_id, segment_hash, previous_segment_hash, next_segment_hash, getting_off_userid FROM road_to_segment WHERE road_id = $1;
            `,
            [roadId]
        );
        return { roadSegments: result.map((row: any) => ({
            roadId: row.road_id,
            segmentHash: row.segment_hash,
            previousSegmentHash: row.previous_segment_hash,
            nextSegmentHash: row.next_segment_hash,
            gettingOffUserId: row.getting_off_userid,
        })) };

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function getTmpRoadToSegmentsByRoadId(roadId: string): Promise<WithError<{ roadSegments: RoadToSegment[] }, string>> {
  try {
      const result = await query(
          `SELECT road_id, segment_hash, previous_segment_hash, next_segment_hash, getting_off_userid FROM temporary_road_to_segment WHERE road_id = $1;
          `,
          [roadId]
      );
      return { roadSegments: result.map((row: any) => ({
          roadId: row.road_id,
          segmentHash: row.segment_hash,
          previousSegmentHash: row.previous_segment_hash,
          nextSegmentHash: row.next_segment_hash,
          gettingOffUserId: row.getting_off_userid,
      })) };
  } catch (error: any) {
      console.error("Error executing query:", error);
      return { error: error.message };
  }
}

export async function getRoadSegment(segmentHash: string): Promise<WithError<{ segment: Segment }, string>> {
    try {
        const result = await query(
            `SELECT segment_hash, segment_length, travel_time FROM road_segments WHERE segment_hash = $1;
            `,
            [segmentHash]
        );

        const travelTimeMs = 
          (result[0].travel_time.minutes || 0) * 60 * 1000 +
          (result[0].travel_time.seconds || 0) * 1000 +
          (result[0].travel_time.milliseconds || 0);

        return { segment: {
            segmentHash: result[0].segment_hash,
            length: result[0].segment_length,
            cost: {
              totalMilliseconds: travelTimeMs,
            },
        }};

    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function setPassengerInRoadSegment(
  passengerId: string,
  segmentId: string
): Promise<WithError<{ segments: Map<number, { segment: Segment }> }, string>> {
  try {
    const result = await query(
      `SELECT * FROM fn_extend_segment_with_passenger($1, $2);`,
      [passengerId, segmentId]
    );

    const segmentsMap = new Map<number, { segment: Segment }>();
result.forEach((row: any) => {
  const travelTimeMs = 
    (row.travel_time.minutes || 0) * 60 * 1000 +
    (row.travel_time.seconds || 0) * 1000 +
    (row.travel_time.milliseconds || 0);

  const segmentLength = parseFloat(row.segment_length);

  const seq = Number(row.seq);

  segmentsMap.set(seq, {
    segment: {
      segmentHash: row.segment_hash,
      length: segmentLength,
      cost: {
        totalMilliseconds: travelTimeMs,
      },
    },
  });
});
  
return {
  segments: segmentsMap,
};
  
    } catch (error: any) {
      console.error("Error executing query:", error);
      return { error: error.message };
    }
  }
