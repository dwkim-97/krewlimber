import {gymBrand} from './gym-brands';
export function gymIdentity(gym: {name: string; brandName?: string; branchName?: string}) {
  if (gym.brandName) return {brandName: gym.brandName, branchName: gym.branchName ?? ''};
  const brand = gymBrand(gym.name);
  if (!brand) return {brandName: gym.name, branchName: ''};
  const compact = gym.name.replace(/\s+/g, '');
  return {brandName: brand.name, branchName: compact.slice(brand.name.length).replace(/^짐/, '')};
}
export function gymDisplayName(brandName: string, branchName: string) {
  return [brandName.trim(), branchName.trim()].filter(Boolean).join(' ');
}
