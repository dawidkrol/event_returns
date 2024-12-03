import { Driver } from "~/models/driver.model";
import { WithError } from "~/utils/utils.type";
import { Request } from "express";


export function validateDriver(req: Request): WithError<{ driverModel: Driver }, string> {
    const { longitude, latitude, numberOfAvailableSeats, initialDepartureTime, finalDepartureTime } = req.body;
    console.log("longitude", longitude, "latitude", latitude, "numberOfAvailableSeats", numberOfAvailableSeats, "initialDepartureTime", initialDepartureTime, "finalDepartureTime", finalDepartureTime);
    if (longitude == null || latitude == null || numberOfAvailableSeats == null || !initialDepartureTime || !finalDepartureTime) {
        return { error: "Missing required fields" };
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