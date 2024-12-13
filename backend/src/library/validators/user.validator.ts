import { User } from "~/models/user.model";
import { WithError } from "~/utils/utils.type";
import { Request } from "express";
import { getPersonById } from "~/repositories/user.repository";

export function validateUser(req: Request): WithError<{ userModel: User }, string> {
    const { name, email } = req.body;
    if (!name || !email) {
        return { error: "Missing required fields" };
    }
    return {
        userModel: {
            name,
            email
        }
    };
}

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
