import { Passenger } from "~/models/passenger.model";
import { query } from "~/utils/db";
import { WithError } from "~/utils/utils.type";

export async function addPassenger(passegnerModel: Passenger): Promise<{ error: Error | null }> {
    try {
        await query(
            `INSERT INTO passengers (user_id, longitude, latitude, number_of_people, initial_departure_time, final_departure_time) 
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id) DO UPDATE SET
            longitude = $2, latitude = $3, number_of_people = $4, initial_departure_time = $5, final_departure_time = $6`,
            [passegnerModel.userId, passegnerModel.longitude, passegnerModel.latitude, passegnerModel.numberOfPeople, passegnerModel.initialDepartureTime, passegnerModel.finalDepartureTime]
        );
        return { error: null };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}

export async function findPassengerById(passengerId: string): Promise<WithError<{ passenger: Passenger | null }, string>> {
    try {
        const result = await query(
            `SELECT * FROM passengers WHERE user_id = $1`,
            [passengerId]
        );

        if (result.length === 0) {
            return { passenger: null };
        }
        
        return { passenger: 
            {
                userId: result[0].user_id,
                longitude: result[0].longitude,
                latitude: result[0].latitude,
                numberOfPeople: result[0].number_of_people,
                initialDepartureTime: result[0].initial_departure_time,
                finalDepartureTime: result[0].final_departure_time,
            }
         };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function findRoadForPassenger(passengerId: string): Promise<WithError<{ roadId: string | null }, string>> {
    try {
        const roadId = await query(
            `SELECT * FROM fn_extend_route_with_passenger($1)`,
            [passengerId]
        );
        return { roadId: roadId[0].v_route_id };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}
