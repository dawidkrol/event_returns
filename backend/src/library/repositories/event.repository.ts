import { query } from "~/utils/db";
import { Event } from "~/models/event.model";
import { WithError } from "~/utils/utils.type";

export async function createEvent(eventModel: Event): Promise<WithError<{ id: string }, Error>> {
    try {
        const data = await query(
            `INSERT INTO events (event_name, event_description, longitude, latitude, event_date)
            VALUES ($1, $2, $3, $4, $5) RETURNING event_id`,
            [eventModel.eventName, eventModel.eventDescription, eventModel.longitude, eventModel.latitude, eventModel.eventDate]
        );
        return { id: data[0].event_id };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}

export async function getEventById(eventId: string): Promise<WithError<{ event: Event }, Error>> {
    try {
        const data = await query(`SELECT * FROM events WHERE event_id = $1`, [eventId]);
        return { event: data[0] };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}
