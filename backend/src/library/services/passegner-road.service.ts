import { RoadToSegment } from "~/models/road-to-segment.model";
import { Segment } from "~/models/segment.model";
import { findNearestDriversRoad, getRoadSegment, getRoadToSegmentsByRoadId, setPassengerInRoadSegment } from "~/repositories/road.repository";
import { addNewRouteProposition } from "~/repositories/tempRoad.repository";
import { WithError } from "~/utils/utils.type";

export async function createPassengerRoad(
  passengerId: string
): Promise<WithError<{roadId: string}, string>> {
    const { roadId, error: optimalRoadError } = await findOptimalRoad(passengerId);
    if (optimalRoadError) {
        return {error: optimalRoadError};
    }
    if (!roadId) {
        return { error: "Road not found" };
    }
    console.log(`optimal road: ${roadId}`);

    const { roadSegments, error: getRoadToSegmentsError } = await getRoadToSegments(roadId!);
    if (getRoadToSegmentsError) {
        return {error: getRoadToSegmentsError};
    }
    if (!roadSegments) {
        return { error: "Road segments not found" };
    }

    const segment_cost_map = new Map<string, {costDifference: number, newSegments: Map<number, { segment: Segment; }>}>();

    var currentSegment = roadSegments!.find(segment => segment.previousSegmentHash == null);
    for (;currentSegment != null && currentSegment != undefined;) {
        const { segment, error: getSegmentError } = await getSegment(currentSegment.segmentHash);
        if (getSegmentError) {
            return {error: getSegmentError};
        }
        if (!segment) {
            return { error: "Segment not found" };
        }
        console.log(`segment: ${segment.segmentHash}`);

        const { segments: newSegemnts, error } = await setPassengerInSegment(passengerId, currentSegment.segmentHash);
        if (error) {
            return {error};
        }
        if (!newSegemnts) {
            return { error: "Segments not found" };
        }
        console.log(`new segments: ${JSON.stringify(newSegemnts)}`);

        const cost = Array.from(newSegemnts.values()).reduce((prev, curr) => prev + curr.segment.cost.totalMilliseconds, 0);
        segment_cost_map.set(
            currentSegment.segmentHash,
            {
            costDifference: cost - segment.cost.totalMilliseconds,
            newSegments: newSegemnts
        });
        console.log(`cost: ${cost}`);

        currentSegment = roadSegments.find(segment => segment.previousSegmentHash === currentSegment?.segmentHash) || undefined;
    }

    const min_cost_segment_hash = Array.from(segment_cost_map.entries()).reduce((prev, curr) => prev[1].costDifference < curr[1].costDifference ? prev : curr);
    console.log(`min cost segment: ${min_cost_segment_hash[1]}`);

    const { error: addNewPropositionError } = await addNewPropositionToTmpTable(min_cost_segment_hash[0], min_cost_segment_hash[1].newSegments, passengerId);
    if (addNewPropositionError) {
        return {error: addNewPropositionError};
    }
    // notify drivers about new proposition

    return { roadId };
}

export async function findOptimalRoad(
  passengerId: string
): Promise<WithError<{roadId: string}, string>> {
    const {roadId, error} = await findNearestDriversRoad(passengerId);
    if (error) {
        return {error};
    }
    if (!roadId) {
        return { error: "Road not found" };
    }
    return { roadId };
}

export async function getRoadToSegments(roadId: string): Promise<WithError<{ roadSegments: RoadToSegment[] }, string>> {
    const { roadSegments, error } = await getRoadToSegmentsByRoadId(roadId);
    if (error) {
        return {error};
    }
    if (!roadSegments) {
        return { error: "Road segments not found" };
    }
    return { roadSegments };
}

export async function getSegment(segmentId: string): Promise<WithError<{segment: Segment}, string>> {
    const { segment, error } = await getRoadSegment(segmentId);
    if (error) {
        return {error};
    }
    if (!segment) {
        return { error: "Segment not found" };
    }
    return { segment };
}

export async function setPassengerInSegment(
    segmentId: string,
    passengerId: string
): Promise<WithError<{ segments: Map<number, { segment: Segment }> }, string>> {
    const { segments, error } = await setPassengerInRoadSegment(segmentId, passengerId);
    if (error) {
        console.error("Error in setPassengerInSegment:", error);
        return { error };
    }

    if (!segments) {
        console.error("Segments not found");
        return { error: "Segments not found" };
    }

    return { segments };
}

export async function addNewPropositionToTmpTable(segmentHash: string, newSegments: Map<number, { segment: Segment; }>, passengerId: string): Promise<WithError<{roadId: string}, string>> {
    const { roadId, error } = await addNewRouteProposition(segmentHash, newSegments.get(1)!.segment.segmentHash, newSegments.get(2)!.segment.segmentHash, passengerId);
    if (error) {
        return {error};
    }
    if (!roadId) {
        return { error: "Road not found" };
    }
    return { roadId };
}
