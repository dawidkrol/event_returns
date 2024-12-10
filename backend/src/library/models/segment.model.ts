type TravelTime = {
    totalMilliseconds: number;
  };
  
export interface Segment {
    segmentHash: string;
    cost: TravelTime;
    length: number;
}