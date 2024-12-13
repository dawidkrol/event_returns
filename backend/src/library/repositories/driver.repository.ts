import exp from "constants";
import { Driver } from "~/models/driver.model";
import { query } from "~/utils/db";
import { WithError } from "~/utils/utils.type";

export async function addDriver(driverModel: Driver): Promise<{ error: Error | null }> {
    try {
        await query(
            `INSERT INTO drivers (user_id, latitude, longitude, initial_departure_time, final_departure_time, number_of_available_seats, number_of_available_passengers)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id) DO UPDATE SET
            latitude = $2, longitude = $3, initial_departure_time = $4, final_departure_time = $5, number_of_available_seats = $6, number_of_available_passengers = $7`,
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

export async function getDriverById(driverId: string): Promise<WithError<{driver: Driver | null}, string>> {
    try {
        const result = await query(
            `SELECT user_id, latitude, longitude, initial_departure_time, final_departure_time, number_of_available_seats FROM drivers WHERE user_id = $1`,
            [driverId]
        );

        if (result.length === 0) {
            return { driver: null };
        }
        
        return { driver: {
            userId: result[0].user_id,
            latitude: result[0].latitude,
            longitude: result[0].longitude,
            initialDepartureTime: result[0].initial_departure_time,
            finalDepartureTime: result[0].final_departure_time,
            numberOfAvailableSeats: result[0].number_of_available_seats
        } };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function changeNumberOfAvailableSeats(driverId: string, numberOfSeats: number): Promise<{ error: string | null }> {
    try {
        await query(
            `UPDATE drivers
            SET number_of_available_seats = $2
            WHERE user_id = $1`,
            [driverId, numberOfSeats]
        );
        return { error: null };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function changeNumberOfAvailablePassengers(driverId: string, numberOfPassengers: number): Promise<{ error: string | null }> {
    try {
        await query(
            `UPDATE drivers
            SET number_of_available_passengers = $2
            WHERE user_id = $1`,
            [driverId, numberOfPassengers]
        );
        return { error: null };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function getNumberOfAvailablePassengers(driverId: string): Promise<WithError<{numberOfPassengers: number | null}, string>> {
    try {
        const result = await query(
            `SELECT number_of_available_passengers FROM drivers WHERE user_id = $1`,
            [driverId]
        );
        return { numberOfPassengers: result[0]?.number_of_available_passengers };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}

export async function getNumberOfAvailableSeats(driverId: string): Promise<WithError<{numberOfSeats: number | null}, string>> {
    try {
        const result = await query(
            `SELECT number_of_available_seats FROM drivers WHERE user_id = $1`,
            [driverId]
        );
        return { numberOfSeats: result[0]?.number_of_available_seats };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error.message };
    }
}
