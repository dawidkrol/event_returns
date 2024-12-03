import { query } from "~/utils/db";
import { User } from "~/models/user.model";
import { WithError } from "~/utils/utils.type";

export async function addPerson(userModel: User, eventId: string): Promise<WithError<{ id: string }, Error>> {
    try {
        const data = await query(
            `INSERT INTO users (person_email, person_name, event_id)
            VALUES ($1, $2, $3) RETURNING user_id`,
            [userModel.email, userModel.name, eventId]
        );
        return { id: data[0].user_id };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}