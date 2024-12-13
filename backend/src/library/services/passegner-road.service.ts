import { ws } from "src/server";
import { RoadToSegment } from "~/models/road-to-segment.model";
import { Segment } from "~/models/segment.model";
import { User } from "~/models/user.model";
import { addPassengersToSeats } from "~/repositories/driver.repository";
import { findPassengerById } from "~/repositories/passenger.repository";
import { findNearestDriversRoad, getRoadPropsByUserId, getRoadSegment, getRoadToSegmentsByRoadId, getTmpRoadToSegmentsByRoadId, setPassengerInRoadSegment } from "~/repositories/road.repository";
import { addNewRouteProposition, getNewPassengersIdByRequestId, getTempRoadPropsByUserId, updateRouteProposition } from "~/repositories/tempRoad.repository";
import { getPersonById } from "~/repositories/user.repository";
import { WithError } from "~/utils/utils.type";

export async function createPassengerRoad(
  passengerId: string
): Promise<WithError<{requestId: string}, string>> {
    const { roadId, driverId, error: optimalRoadError } = await findOptimalRoad(passengerId);
    let requestId: string | undefined = undefined;

    if (optimalRoadError) {
        return {error: optimalRoadError};
    }
    if (!roadId) {
        return { error: "Road not found" };
    }
    if (!driverId) {
        return { error: "Driver not found" };
    }

    const { roadSegments: tmpRoadSegments, error: getTmpRoadToSegmentsError } = await getTmpRoadToSegments(roadId!);
    
    if (getTmpRoadToSegmentsError) {
        return {error: getTmpRoadToSegmentsError};
    }
    if (tmpRoadSegments && tmpRoadSegments.length > 0) {
        console.log("Creating passenger road from tmp road");
        const { requestId: request_id, error } = await createPassengerRoadFromTmpRoad(roadId!, passengerId);
        if (error) {
            return {error};
        }
        requestId = request_id;
    }
    else {
        console.log("Creating passenger road from active road");
        const { requestId: request_id, error } = await createPassengerRoadFromActiveRoad(roadId!, passengerId);
        console.log("createPassengerRoadFromActiveRoad", requestId, error);
        if (error) {
            return {error};
        }
        requestId = request_id;
    }
    const { passenger, error: findPassengerError }  = await findPassengerById(passengerId);
    if(findPassengerError) {
        console.error("Error in findPassengerById:", findPassengerError);
        return {error: findPassengerError};
    }
    if (!passenger) {
        return { error: "Passenger not found" };
    }
    
    const { error: addPassengersToSeatsError } = await addPassengersToSeats(driverId, passenger.numberOfPeople);
    if (addPassengersToSeatsError) {
        return { error: addPassengersToSeatsError };
    }
    
    if(!requestId) {
        return { error: "Request not found" };
    }

    var passengersIds = await getNewPassengersIdByRequestId(requestId);
    const passengers: User[] = await Promise.all(passengersIds.passengerId.map(async (passengerId) => {
        const { user, error } = await getPersonById(passengerId);
        if (error) {
            throw error;
        }
        return user!;
    })).catch((error) => {
        return [];
    });

    var { roadLength, travelTime, error } = await getRoadPropsByUserId(driverId);
    if (error) {
        return {error};
    }

    var { roadLength: tempRoadLength, travelTime: tempTravelTime, error } = await getTempRoadPropsByUserId(driverId);
    if (error) {
        return {error};
    }

    console.log("Sending message to driver", driverId);
    ws.sendMessageToDriver(driverId, JSON.stringify(
        { 
            type: "new_proposition", 
            requestId, 
            new_passengers: 
                [ passengers.map(passenger => ({ name: passenger.name, email: passenger.email })) ],
            difference_route_length: (roadLength ?? 0) - (tempRoadLength ?? 0),
            difference_route_time: (travelTime ?? 0) - (tempTravelTime ?? 0)
     }));

    return { requestId };
}

export async function createPassengerRoadFromActiveRoad(roadId: string, passengerId: string): Promise<WithError<{requestId: string}, string>>
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

    const { requestId, error: addNewPropositionError } = await addNewPropositionToTmpTable(roadId, min_cost_segment_hash[0], min_cost_segment_hash[1].newSegments, passengerId);
    console.log("createPassengerRoadFromActiveRoad", requestId, addNewPropositionError);
    if (addNewPropositionError) {
        return {error: addNewPropositionError};
    }
    if(!requestId) {
        return { error: "Request not found" };
    }

    return { requestId };
}

export async function createPassengerRoadFromTmpRoad(roadId: string, passengerId: string): Promise<WithError<{requestId: string}, string>>
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

    const { requestId, error: updatePropositionError } = await updatePropositionInTmpTable(roadId, min_cost_segment_hash[0], min_cost_segment_hash[1].newSegments, passengerId);
    if (updatePropositionError) {
        return {error: updatePropositionError};
    }
    if(!requestId) {
        return { error: "Request not found" };
    }

    return { requestId };
}

export async function findOptimalRoad(
  passengerId: string
): Promise<WithError<{roadId: string, driverId: string}, string>> {
    const {roadId, driverId, error} = await findNearestDriversRoad(passengerId);
    if (error) {
        return {error};
    }
    if (!roadId) {
        return { error: "Road not found" };
    }
    if (!driverId) {
        return { error: "Driver not found" };
    }
    return { roadId, driverId };
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

export async function addNewPropositionToTmpTable(roadId: string, segmentHash: string, newSegments: Map<number, { segment: Segment; }>, passengerId: string): Promise<WithError<{requestId: string}, string>> {
    const { requestId, error } = await addNewRouteProposition(segmentHash, newSegments.get(1)!.segment.segmentHash, newSegments.get(2)!.segment.segmentHash, passengerId, roadId);
    console.log("addNewPropositionToTmpTable", requestId, error);
    if (error) {
        return {error};
    }
    if (!requestId) {
        return { error: "Road not found" };
    }
    return { requestId };
}

export async function updatePropositionInTmpTable(roadId: string, segmentHash: string, newSegments: Map<number, { segment: Segment; }>, passengerId: string): Promise<WithError<{requestId: string}, string>> {
    const { requestId, error } = await updateRouteProposition(roadId, segmentHash, newSegments.get(1)!.segment.segmentHash, newSegments.get(2)!.segment.segmentHash, passengerId);
    if (error) {
        return {error};
    }
    if (!requestId) {
        return { error: "Road not found" };
    }
    return { requestId };
}
