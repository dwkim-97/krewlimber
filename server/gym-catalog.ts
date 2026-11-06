import type {Gym} from '../src/types/climbing';
import catalog from './gyms.catalog.json';

const aliases = new Map([
  ['2003676296', '953399573'],
  ['1371007415', '408430175'],
  ['1965545283', '367482090'],
  ['1586294019', '958971411'],
  ['1146352662', '26095021'],
  ['1700395604', '768810860'],
  ['621524945', '1269936251'],
]);
export function canonicalGymId(id: string): string {
  return aliases.get(id) ?? id;
}
export function sameGymIds(id: string): string[] {
  const canonical = canonicalGymId(id);
  return [canonical, ...[...aliases.keys()].filter(key => aliases.get(key) === canonical)];
}
export function gymAliases(id: string): string[] {
  return catalog.gyms
    .filter(g => g.id !== canonicalGymId(id) && canonicalGymId(g.id) === canonicalGymId(id))
    .map(g => g.name);
}
export function catalogGyms(): Gym[] {
  return catalog.gyms.filter(g => canonicalGymId(g.id) === g.id).map(g => ({...g, aliases: gymAliases(g.id)}));
}
