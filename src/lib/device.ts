import * as Device from 'expo-device';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';

/**
 * What the phone can tell us about itself without asking the user for anything.
 *
 * None of this needs a permission prompt and none of it leaves the device - it is read at
 * runtime purely to pick sensible defaults (kg vs lb, first day of week) and to show the
 * user which device this profile belongs to.
 */
export type DeviceProfile = {
  /** "iPhone 15 Pro", "Pixel 8", or null on web / an unrecognised device. */
  model: string | null;
  manufacturer: string | null;
  /** "iOS 18.2", "Android 15", "Web". */
  osLabel: string;
  platform: 'ios' | 'android' | 'web' | 'other';
  /** False in a simulator or the browser. */
  isPhysicalDevice: boolean;
  /** BCP-47 tag, e.g. "en-CA". */
  locale: string;
  region: string | null;
  timeZone: string | null;
  /** What the phone's own region settings imply about weight units. */
  measurementSystem: 'metric' | 'us' | 'uk' | null;
};

function platformName(): DeviceProfile['platform'] {
  if (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return 'other';
}

export function readDeviceProfile(): DeviceProfile {
  // Localization.getLocales() is never empty in practice, but a defensive read costs nothing
  // and a crash on the profile tab would be a poor trade.
  const locales = Localization.getLocales();
  const primary = locales.length > 0 ? locales[0] : null;
  const calendars = Localization.getCalendars();
  const calendar = calendars.length > 0 ? calendars[0] : null;

  const osVersion = Device.osVersion ?? '';
  const osName = Device.osName ?? Platform.OS;

  return {
    model: Device.modelName,
    manufacturer: Device.manufacturer,
    osLabel: osVersion ? `${osName} ${osVersion}` : osName,
    platform: platformName(),
    isPhysicalDevice: Device.isDevice,
    locale: primary?.languageTag ?? 'en',
    region: primary?.regionCode ?? null,
    timeZone: calendar?.timeZone ?? null,
    measurementSystem: primary?.measurementSystem ?? null,
  };
}

/**
 * Whole years since `birthDate` (an ISO yyyy-mm-dd string), or null if unset or unparseable.
 *
 * The string is split into calendar components rather than fed to `new Date()`. A bare
 * yyyy-mm-dd is parsed as UTC midnight, and comparing that against local-time getters shifts
 * the date by a day for anyone west of UTC - a birthday would tick over a day early. A date
 * of birth is a calendar date, not an instant, so it is compared as one.
 */
export function ageFrom(birthDate: string | null, now = new Date()): number | null {
  if (!birthDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let age = now.getFullYear() - year;
  const monthDelta = now.getMonth() + 1 - month;
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < day)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Body mass index, or null unless both measurements are present and sane. */
export function bmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg || heightCm < 50 || heightCm > 260) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
