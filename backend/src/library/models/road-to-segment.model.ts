export interface RoadToSegment {
    roadId: string;
    segmentHash: string;
    previousSegmentHash: string | null;
    nextSegmentHash: string | null;
    gettingOfUserId: string;
}
