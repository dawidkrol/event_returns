import { Driver } from "~/models/driver.model";
import { WithError } from "~/utils/utils.type";
import { Request } from "express";


export function validateDriver(req: Request): WithError<{ driverModel: Driver }, string> {
    const { longitude, latitude, numberOfAvailableSeats, initialDepartureTime, finalDepartureTime } = req.body;
    if (longitude == null || latitude == null || numberOfAvailableSeats == null || !initialDepartureTime || !finalDepartureTime) {
        return { error: "Missing required fields" };
    }

    if (initialDepartureTime >= finalDepartureTime) {
        return { error: "Initial departure time must be before final departure time" };
    }

    return {
        driverModel: {
            userId: req.params.userId,
            longitude,
            latitude,
            numberOfAvailableSeats,
            initialDepartureTime,
            finalDepartureTime
        }
    };
}