
export enum GalaxyType {
  SPIRAL = 'مارپیچی',
  BARRED_SPIRAL = 'مارپیچی میله‌ای',
  ELLIPTICAL = 'بیضوی',
  IRREGULAR = 'نامنظم',
  LENTICULAR = 'عدسی'
}

export enum CosmicEvent {
  COLLISION = 'برخورد دو کهکشان',
  SUPERNOVA = 'انفجار ابرنواختر',
  QUASAR = 'کوازار (هسته فعال)'
}

export interface GalaxyParams {
  type: GalaxyType | CosmicEvent;
  starsCount: number;
  radius: number;
  branches: number;
  spin: number;
  randomness: number;
  randomnessPower: number;
  insideColor: string;
  outsideColor: string;
  isEvent?: boolean;
}

export interface Message {
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}
