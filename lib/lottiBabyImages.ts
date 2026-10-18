/**
 * Zentrale Liste der 30 Lotti-Level-Bilder (Stufe 1–30).
 * Wird von LottiWeekCard, LottiJourneyMap und LottiCollection geteilt.
 */

import type { ImageSourcePropType } from 'react-native';

export const LEVEL_BABY_IMAGES: readonly ImageSourcePropType[] = [
  require('@/assets/images/LottiBaby_Babys/1.jpg'),
  require('@/assets/images/LottiBaby_Babys/2.jpg'),
  require('@/assets/images/LottiBaby_Babys/3.jpg'),
  require('@/assets/images/LottiBaby_Babys/4.jpg'),
  require('@/assets/images/LottiBaby_Babys/5.jpg'),
  require('@/assets/images/LottiBaby_Babys/6.jpg'),
  require('@/assets/images/LottiBaby_Babys/7.jpg'),
  require('@/assets/images/LottiBaby_Babys/8.jpg'),
  require('@/assets/images/LottiBaby_Babys/9.jpg'),
  require('@/assets/images/LottiBaby_Babys/10.jpg'),
  require('@/assets/images/LottiBaby_Babys/11.jpg'),
  require('@/assets/images/LottiBaby_Babys/12.jpg'),
  require('@/assets/images/LottiBaby_Babys/13.jpg'),
  require('@/assets/images/LottiBaby_Babys/14.jpg'),
  require('@/assets/images/LottiBaby_Babys/15.jpg'),
  require('@/assets/images/LottiBaby_Babys/16.jpg'),
  require('@/assets/images/LottiBaby_Babys/17.jpg'),
  require('@/assets/images/LottiBaby_Babys/18.jpg'),
  require('@/assets/images/LottiBaby_Babys/19.jpg'),
  require('@/assets/images/LottiBaby_Babys/20.jpg'),
  require('@/assets/images/LottiBaby_Babys/21.jpg'),
  require('@/assets/images/LottiBaby_Babys/22.jpg'),
  require('@/assets/images/LottiBaby_Babys/23.jpg'),
  require('@/assets/images/LottiBaby_Babys/24.jpg'),
  require('@/assets/images/LottiBaby_Babys/25.jpg'),
  require('@/assets/images/LottiBaby_Babys/26.jpg'),
  require('@/assets/images/LottiBaby_Babys/27.jpg'),
  require('@/assets/images/LottiBaby_Babys/28.jpg'),
  require('@/assets/images/LottiBaby_Babys/29.jpg'),
  require('@/assets/images/LottiBaby_Babys/30.jpg'),
];

/** Bild für eine Stufe (1-basiert, zyklisch abgesichert). */
export function babyImageForLevel(level: number): ImageSourcePropType {
  return LEVEL_BABY_IMAGES[
    (Math.max(1, Math.floor(level)) - 1) % LEVEL_BABY_IMAGES.length
  ];
}
