import { animalRig, isAnimalType } from './animalRigs';
import { DOG_RIG } from './dog';
import { ELEPHANT_RIG } from './elephant';
import { MAN_RIG, Rig, WOMAN_RIG } from './figure';
import { HORSE_RIG } from './horse';

/** Skelet predmeta, če ima sklepe (figure in živali). */
export function rigOf(type: string | undefined): Rig | null {
  switch (type) {
    case 'figure':
      return MAN_RIG;
    case 'woman':
      return WOMAN_RIG;
    case 'dog':
      return DOG_RIG;
    case 'horse':
      return HORSE_RIG;
    case 'elephant':
      return ELEPHANT_RIG;
    default:
      return isAnimalType(type) ? animalRig(type) : null;
  }
}

export const isPosable = (type: string | undefined): boolean => rigOf(type) !== null;
