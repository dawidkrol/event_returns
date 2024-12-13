import { getDriverById } from "~/repositories/driver.repository";
import { WithError } from "~/utils/utils.type";

export async function checkIfDriverExists(driverID: string): Promise<WithError<{exists: boolean}, string>> {
    const { driver, error } = await getDriverById(driverID);
    if (error) {
        return { error: "Error fetching driver" };
    }
    if (!driver) {
        return { exists: false };
    }
    return { exists: true };
}
