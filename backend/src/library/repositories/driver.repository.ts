import { Driver } from "~/models/driver.model";
import { query } from "~/utils/db";

export async function addDriver(driverModel: Driver): Promise<{ error: Error | null }> {
    try {
        await query(
            `INSERT INTO drivers (user_id, latitude, longitude, initial_departure_time, final_departure_time, number_of_available_seats, number_of_available_passengers)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [driverModel.userId, driverModel.latitude, driverModel.longitude, driverModel.initialDepartureTime, driverModel.finalDepartureTime, driverModel.numberOfAvailableSeats, driverModel.numberOfAvailableSeats]
        );
        return { error: null };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}

export async function addPassengersToSeats(driverId: string, numberOfPassengers: number): Promise<{ error: string | null }> {
    try {
        await query(
            `UPDATE drivers
            SET number_of_available_passengers = number_of_available_passengers - $2
            WHERE user_id = $1`,
            [driverId, numberOfPassengers]
        );
        return { error: null };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function removePassengersFromSeats(driverId: string, numberOfPassengers: number): Promise<{ error: Error | null }> {
    try {
        await query(
            `UPDATE drivers
            SET number_of_available_passengers = number_of_available_passengers + $2
            WHERE user_id = $1`,
            [driverId, numberOfPassengers]
        );
        return { error: null };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}
