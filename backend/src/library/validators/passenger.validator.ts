import { Passenger } from "~/models/passenger.model";
import { WithError } from "~/utils/utils.type";
import { Request } from "express";


export function validatePassenger(req: Request): WithError<{ passengerModel: Passenger }, string> {
    const { longitude, latitude, numberOfPeople, initialDepartureTime, finalDepartureTime } = req.body;
    if (longitude == null || latitude == null || numberOfPeople == null || !initialDepartureTime || !finalDepartureTime) {
        return { error: "Missing required fields" };
    }

    if (initialDepartureTime >= finalDepartureTime) {
        return { error: "Initial departure time must be before final departure time" };
    }

    return {
        passengerModel: {
            userId: req.params.userId,
            longitude,
            latitude,
            numberOfPeople,
            initialDepartureTime,
            finalDepartureTime,
            driverId: null
        }
    };
}