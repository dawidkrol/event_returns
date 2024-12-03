import { Driver } from "~/models/driver.model";
import { query } from "~/utils/db";

export async function addDriver(driverModel: Driver): Promise<{ error: Error | null }> {
    try {
        await query(
            `INSERT INTO drivers (user_id, latitude, longitude, initial_departure_time, final_departure_time, number_of_available_seats)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [driverModel.userId, driverModel.latitude, driverModel.longitude, driverModel.initialDepartureTime, driverModel.finalDepartureTime, driverModel.numberOfAvailableSeats]
        );
        return { error: null };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}
