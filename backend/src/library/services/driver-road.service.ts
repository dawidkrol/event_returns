import { query } from "~/utils/db";
import { WithError } from "~/utils/utils.type";

export async function createDriverRoad(
  driverId: string
): Promise<WithError<{roadId: string}, string>> {
    try{
  const road_id = await query(
    'SELECT fn_create_event_road($1)',
    [driverId]
  );
  return {roadId: road_id[0].fn_create_event_road};
}
catch (err) {
    console.error("Error executing function:", err);
    return {error: "Error executing function"};
}

}

export async function addSegmentToDriverRoad(
  roadId: string
): Promise<{error: string | null}> {
    try{
    await query(
        'SELECT fn_add_first_segment_to_road($1)',
        [roadId]
    );
    return {error: null};
    }
    catch (err) {
        console.error("Error executing function:", err);
        return {error: "Error executing function"};
    }
}
