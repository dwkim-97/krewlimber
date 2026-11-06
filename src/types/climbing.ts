export interface GymGrade {
  id: string;
  gymId: string;
  name: string;
  color: string;
}
export interface Gym {
  revision?: string;
  brandName?: string;
  branchName?: string;
  placeId: string | null;
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  grades: GymGrade[];
}
export interface Visit {
  id: string;
  gymId: string;
  gymName: string;
  visitedOn: string;
  note: string;
  requestId: string;
  sends: (GymGrade & {gradeId: string; count: number})[];
}
export interface LevelSummaryData {
  level: number;
  inputs: {
    visits: number;
    sends: number;
    gyms: number;
    earnedAchievements: {id: string; name: string}[];
    byGrade: {gymName: string; gradeId: string; name: string; color: string; count: number}[];
  };
}
