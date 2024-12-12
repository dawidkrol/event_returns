import { WithError } from "~/utils/utils.type";

export async function checkIfRequestExists(requestId: string): Promise<WithError<{exists: boolean}, string>> {
    const { user, error } = await getRoadByRequestId(requestId);
    if (error) {
        return { error: "Error fetching user" };
    }
    if (!user) {
        return {exists: false};
    }
    return { exists: true };
}