import { User } from "~/models/user.model";
import { WithError } from "~/utils/utils.type";
import { Request } from "express";

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