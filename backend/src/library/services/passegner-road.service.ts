import { RoadToSegment } from "~/models/road-to-segment.model";
import { Segment } from "~/models/segment.model";
import { findNearestDriversRoad, getRoadSegment, getRoadToSegmentsByRoadId, getTmpRoadToSegmentsByRoadId, setPassengerInRoadSegment } from "~/repositories/road.repository";
import { addNewRouteProposition, updateRouteProposition } from "~/repositories/tempRoad.repository";
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

    const { roadSegments: tmpRoadSegments, error: getTmpRoadToSegmentsError } = await getTmpRoadToSegments(roadId!);
    
    if (getTmpRoadToSegmentsError) {
        return {error: getTmpRoadToSegmentsError};
    }
    if (tmpRoadSegments && tmpRoadSegments.length > 0) {
        console.log("Creating passenger road from tmp road");
        const { error } = await createPassengerRoadFromTmpRoad(roadId!, passengerId);
        if (error) {
            return {error};
        }
    }
    else {
        console.log("Creating passenger road from active road");
        const { error } = await createPassengerRoadFromActiveRoad(roadId!, passengerId);
        if (error) {
            return {error};
        }
    }
    // notify drivers about new proposition
    return { roadId };
}

export async function createPassengerRoadFromActiveRoad(roadId: string, passengerId: string): Promise<WithError<{roadId: string}, string>>
{
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

        const { segments: newSegments, error } = await setPassengerInSegment(passengerId, currentSegment.segmentHash);
        if (error) {
            return {error};
        }
        if (!newSegments) {
            return { error: "Segments not found" };
        }

        const cost = Array.from(newSegments.values()).reduce((prev, curr) => prev + curr.segment.cost.totalMilliseconds, 0);
        segment_cost_map.set(
            currentSegment.segmentHash,
            {
            costDifference: cost - segment.cost.totalMilliseconds,
            newSegments: newSegments
        });

        currentSegment = roadSegments.find(segment => segment.previousSegmentHash === currentSegment?.segmentHash) || undefined;
    }

    const min_cost_segment_hash = Array.from(segment_cost_map.entries()).reduce((prev, curr) => prev[1].costDifference < curr[1].costDifference ? prev : curr);

    const { error: addNewPropositionError } = await addNewPropositionToTmpTable(min_cost_segment_hash[0], min_cost_segment_hash[1].newSegments, passengerId);
    if (addNewPropositionError) {
        return {error: addNewPropositionError};
    }

    return { roadId };
}

export async function createPassengerRoadFromTmpRoad(roadId: string, passengerId: string): Promise<WithError<{roadId: string}, string>>
{
    const { roadSegments, error: getRoadToSegmentsError } = await getTmpRoadToSegments(roadId!);
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

        const { segments: newSegments, error } = await setPassengerInSegment(passengerId, currentSegment.segmentHash);
        if (error) {
            return {error};
        }
        if (!newSegments) {
            return { error: "Segments not found" };
        }

        const cost = Array.from(newSegments.values()).reduce((prev, curr) => prev + curr.segment.cost.totalMilliseconds, 0);
        segment_cost_map.set(
            currentSegment.segmentHash,
            {
            costDifference: cost - segment.cost.totalMilliseconds,
            newSegments: newSegments
        });

        currentSegment = roadSegments.find(segment => segment.previousSegmentHash === currentSegment?.segmentHash) || undefined;
    }

    console.log("segment_cost_map", JSON.stringify(segment_cost_map.entries()));

    const min_cost_segment_hash = Array.from(segment_cost_map.entries()).reduce((prev, curr) => prev[1].costDifference < curr[1].costDifference ? prev : curr);

    const { error: updatePropositionError } = await updatePropositionInTmpTable(min_cost_segment_hash[0], min_cost_segment_hash[1].newSegments, passengerId);
    if (updatePropositionError) {
        return {error: updatePropositionError};
    }

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

export async function getTmpRoadToSegments(roadId: string): Promise<WithError<{ roadSegments: RoadToSegment[] }, string>> {
    const { roadSegments, error } = await getTmpRoadToSegmentsByRoadId(roadId);
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

export async function updatePropositionInTmpTable(segmentHash: string, newSegments: Map<number, { segment: Segment; }>, passengerId: string): Promise<WithError<{roadId: string}, string>> {
    const { roadId, error } = await updateRouteProposition(segmentHash, newSegments.get(1)!.segment.segmentHash, newSegments.get(2)!.segment.segmentHash, passengerId);
    if (error) {
        return {error};
    }
    if (!roadId) {
        return { error: "Road not found" };
    }
    return { roadId };
}
