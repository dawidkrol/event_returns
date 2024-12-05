import { WithError } from "~/utils/utils.type";
import { Request } from "express";
import { Event } from "~/models/event.model";
import { getEventById } from "~/repositories/event.repository";

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

export async function checkIfEventExists(eventId: string): Promise<{ error: string | null}> {
    const { error } = await getEventById(eventId);
    if (error) {
        return { error: "Error fetching event" };
    }
    return { error: null };
}
