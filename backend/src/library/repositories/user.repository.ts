import { query } from "~/utils/db";
import { User } from "~/models/user.model";
import { WithError } from "~/utils/utils.type";

export async function addPerson(userModel: User, eventId: string, isOrganizer: boolean = false): Promise<WithError<{ id: string }, Error>> {
    try {
        const data = await query(
            `INSERT INTO users (person_email, person_name, event_id, is_organizer)
            VALUES ($1, $2, $3, $4) RETURNING user_id`,
            [userModel.email, userModel.name, eventId, isOrganizer]
        );
        return { id: data[0].user_id };
    } catch (error) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}

export async function getPeopleByEventId(eventId: string): Promise<WithError<{people: User[]}, Error>> {
    try {
        const data = await query(`SELECT * FROM users WHERE event_id = $1`, [eventId]);
        const people = await Promise.all(data.map(async (person) => {
            return {
                email: person.person_email,
                name: person.person_name,
                id: person.user_id
            } as User;
        }));
        return { people };
    } catch (error) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}

export async function getPersonById(personId: string): Promise<WithError<{ user: User}, Error>> {
    try {
        const data = await query(`SELECT person_name, person_email FROM users WHERE user_id = $1`, [personId]);
        return { user: {
            name: data[0].person_name,
            email: data[0].person_email
        }};
    } catch (error) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
}
