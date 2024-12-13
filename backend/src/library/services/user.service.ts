import { getPersonById } from "~/repositories/user.repository";

export async function checkIfUserExists(userID: string): Promise<{ error: string | null }> {
    const { user, error } = await getPersonById(userID);
    if (error) {
        return { error: "Error fetching user" };
    }
    if (!user) {
        return { error: "User not found" };
    }
    return { error: null };
}
