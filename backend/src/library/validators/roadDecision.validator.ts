import { getRoutePropositionByUserIdAndDriverId, getRoutePropositionRoadIdByRequestId } from "~/repositories/tempRoad.repository";
import { WithError } from "~/utils/utils.type";

export async function checkIfRequestExists(requestId: string): Promise<WithError<{exists: boolean}, string>> {
    const { roadId, error } = await getRoutePropositionRoadIdByRequestId(requestId);
    if (error) {
        return { error: "Error fetching user" };
    }
    if (!roadId) {
        return {exists: false};
    }
    return { exists: true };
}

export async function checkIfRequestAndDriverAreConnected(requestId: string, driverId: string): Promise<WithError<{connected: boolean}, string>> {
    const { roadId, error } = await getRoutePropositionByUserIdAndDriverId(requestId, driverId);
    if (error) {
        return { error: "Error fetching user" };
    }
    if (!roadId) {
        return {connected: false};
    }
    return { connected: true };
}