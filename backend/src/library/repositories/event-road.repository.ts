import { query } from "~/utils/db";
import { WithError } from "~/utils/utils.type";

export async function createEventRoad(
    userId: string,
    startLongitude: number,
    startLatitude: number,
    endLongitude: number,
    endLatitude: number,
): Promise<WithError<{eventRoadId: string}, string>> {
    try{
    const eventRoadId = await query(`
        SELECT fn_create_event_road($1, $2, $3, $4, $5)`,
        [userId, startLongitude, startLatitude, endLongitude, endLatitude])
    return {eventRoadId: eventRoadId[0].road_id};
    } catch (err) {
        console.error("Error executing function:", err);
        return {error: "Error executing function"};
    }
}
