import { getEventById } from "~/repositories/event.repository";

export async function checkIfEventExists(eventId: string): Promise<{ error: string | null}> {
    const { error } = await getEventById(eventId);
    if (error) {
        return { error: "Error fetching event" };
    }
    return { error: null };
}
