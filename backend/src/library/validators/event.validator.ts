import { WithError } from "~/utils/utils.type";
import { Request } from "express";
import { Event } from "~/models/event.model";

export function validateEvent(req: Request): WithError<{ eventModel: Event }, string> {
    const { eventName, eventDescription, longitude, latitude, eventDate, organizer } = req.body;
    const { name, email } = organizer;
    if (!eventName || !eventDescription || !longitude || !latitude || !eventDate) {
        return { error: "Missing required fields" };
    }

    return {
        eventModel: {
            eventName,
            eventDescription,
            longitude,
            latitude,
            eventDate,
            organizer: {
                name,
                email
            }
        }
    };
}
