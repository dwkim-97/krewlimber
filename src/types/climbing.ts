export interface Gym {
  aliases: string[];
  id: string;
  name: string;
  address: string;
  region: string;
  franchiseId: string;
  franchiseName: string;
  url: string;
}
export interface GymCatalog {
  verifiedAt: string;
  exhaustive: boolean;
  coverageNote: string;
  gyms: Gym[];
}
export interface ClimbColor {
  key: string;
  name: string;
  hex: string;
}
export interface ColorCount extends ClimbColor {
  count: number;
}
export interface ClimbInput {
  date: string;
  gymId: string;
  colors: ColorCount[];
}
export interface ClimbRecord extends ClimbInput {
  id: string;
  gym: Gym;
  createdAt: string;
  updatedAt: string;
}
export interface BranchSummary {
  gym: Gym;
  visits: number;
  totalSends: number;
  colors: ColorCount[];
}
export interface FranchiseSummary {
  franchiseId: string;
  franchiseName: string;
  visits: number;
  totalSends: number;
  colors: ColorCount[];
  branches: BranchSummary[];
}
export interface ClimbingSummary {
  visits: number;
  totalSends: number;
  groups: FranchiseSummary[];
}
