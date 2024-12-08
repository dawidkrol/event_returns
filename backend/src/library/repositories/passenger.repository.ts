import { Passenger } from "~/models/passenger.model";
import { query } from "~/utils/db";
import { WithError } from "~/utils/utils.type";

export async function addPassenger(passegnerModel: Passenger): Promise<{ error: Error | null }> {
    try {
        await query(
            `INSERT INTO passengers (user_id, longitude, latitude, number_of_people, initial_departure_time, final_departure_time, driver_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [passegnerModel.userId, passegnerModel.longitude, passegnerModel.latitude, passegnerModel.numberOfPeople, passegnerModel.initialDepartureTime, passegnerModel.finalDepartureTime, null]
        );
        return { error: null };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}

export async function findRoadForPassenger(passengerId: string): Promise<WithError<{ roadId: string }, string>> {
    try {
        const roadId = await query(
            `SELECT * FROM fn_extend_route_with_passenger($1)`,
            [passengerId]
        );
        return { roadId: roadId[0].v_road_id };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}
