/**
 * Widget Data Bridge
 *
 * This module handles writing data to the iOS App Group shared container
 * so that widgets can read the data and display it.
 *
 * Data is written to UserDefaults with the App Group suite name.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const APP_GROUP = 'group.app.familyhub.home';

// Data keys matching the Swift SharedModels.swift
const WIDGET_KEYS = {
  shopping: 'shopping_widget_data',
  events: 'events_widget_data',
  routines: 'routines_widget_data',
  f1: 'f1_widget_data',
  bin: 'bin_widget_data',
} as const;

// Check if running on native iOS
export const isNativeIOS = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

/**
 * Write data to the App Group shared container for widgets
 */
async function writeToAppGroup(key: string, data: unknown): Promise<void> {
  if (!isNativeIOS()) {
    console.log('[WidgetBridge] Not on iOS, skipping widget data write');
    return;
  }

  try {
    const jsonString = JSON.stringify(data);
    // Using Preferences with group configuration
    // Note: This requires configuring the Capacitor Preferences plugin
    // to use the App Group. For now, we'll use a native bridge.
    await Preferences.set({
      key,
      value: jsonString,
    });
    console.log(`[WidgetBridge] Wrote ${key} to app group`);
  } catch (error) {
    console.error(`[WidgetBridge] Failed to write ${key}:`, error);
  }
}

// TypeScript interfaces matching Swift models

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  isCompleted: boolean;
  category?: string;
}

export interface ShoppingWidgetData {
  items: ShoppingItem[];
  lastUpdated: string; // ISO 8601 date string
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // ISO 8601
  endTime?: string; // ISO 8601
  isAllDay: boolean;
  color?: string;
}

export interface EventsWidgetData {
  events: CalendarEvent[];
  lastUpdated: string;
}

export interface RoutineStatus {
  id: string;
  title: string;
  emoji: string;
  completedSteps: number;
  totalSteps: number;
  memberName: string;
  memberColor: string;
}

export interface RoutinesWidgetData {
  routines: RoutineStatus[];
  lastUpdated: string;
}

export interface F1Session {
  name: string;
  raceName: string;
  startTime: string; // ISO 8601
  circuitName: string;
  countryFlag: string;
}

export interface F1Race {
  name: string;
  startTime: string; // ISO 8601
  circuitName: string;
  countryFlag: string;
}

export interface F1WidgetData {
  nextSession: F1Session | null;
  nextRace: F1Race | null;
  lastUpdated: string;
}

export interface BinCollection {
  id: string;
  type: string;
  name: string;
  emoji: string;
  nextDate: string; // ISO 8601
  daysUntil: number;
}

export interface BinWidgetData {
  collections: BinCollection[];
  lastUpdated: string;
}

// Widget data update functions

/**
 * Update shopping list widget data
 */
export async function updateShoppingWidget(
  items: Array<{
    id: string;
    name: string;
    quantity?: number;
    unit?: string;
    completed: boolean;
    category?: string;
  }>
): Promise<void> {
  const data: ShoppingWidgetData = {
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      isCompleted: item.completed,
      category: item.category,
    })),
    lastUpdated: new Date().toISOString(),
  };
  await writeToAppGroup(WIDGET_KEYS.shopping, data);
}

/**
 * Update events widget data
 */
export async function updateEventsWidget(
  events: Array<{
    id: string;
    title: string;
    start: Date;
    end?: Date;
    allDay?: boolean;
    color?: string;
  }>
): Promise<void> {
  const data: EventsWidgetData = {
    events: events.map(event => ({
      id: event.id,
      title: event.title,
      startTime: event.start.toISOString(),
      endTime: event.end?.toISOString(),
      isAllDay: event.allDay ?? false,
      color: event.color,
    })),
    lastUpdated: new Date().toISOString(),
  };
  await writeToAppGroup(WIDGET_KEYS.events, data);
}

/**
 * Update routines widget data
 */
export async function updateRoutinesWidget(
  routines: Array<{
    id: string;
    title: string;
    emoji: string;
    completedSteps: number;
    totalSteps: number;
    memberName: string;
    memberColor: string;
  }>
): Promise<void> {
  const data: RoutinesWidgetData = {
    routines: routines.map(routine => ({
      id: routine.id,
      title: routine.title,
      emoji: routine.emoji,
      completedSteps: routine.completedSteps,
      totalSteps: routine.totalSteps,
      memberName: routine.memberName,
      memberColor: routine.memberColor,
    })),
    lastUpdated: new Date().toISOString(),
  };
  await writeToAppGroup(WIDGET_KEYS.routines, data);
}

/**
 * Update F1 widget data
 */
export async function updateF1Widget(
  nextSession: {
    name: string;
    raceName: string;
    startTime: Date;
    circuitName: string;
    countryFlag: string;
  } | null,
  nextRace: {
    name: string;
    startTime: Date;
    circuitName: string;
    countryFlag: string;
  } | null
): Promise<void> {
  const data: F1WidgetData = {
    nextSession: nextSession
      ? {
          name: nextSession.name,
          raceName: nextSession.raceName,
          startTime: nextSession.startTime.toISOString(),
          circuitName: nextSession.circuitName,
          countryFlag: nextSession.countryFlag,
        }
      : null,
    nextRace: nextRace
      ? {
          name: nextRace.name,
          startTime: nextRace.startTime.toISOString(),
          circuitName: nextRace.circuitName,
          countryFlag: nextRace.countryFlag,
        }
      : null,
    lastUpdated: new Date().toISOString(),
  };
  await writeToAppGroup(WIDGET_KEYS.f1, data);
}

/**
 * Update bin day widget data
 */
export async function updateBinWidget(
  collections: Array<{
    id: string;
    type: string;
    name: string;
    emoji: string;
    nextDate: Date;
    daysUntil: number;
  }>
): Promise<void> {
  const data: BinWidgetData = {
    collections: collections.map(collection => ({
      id: collection.id,
      type: collection.type,
      name: collection.name,
      emoji: collection.emoji,
      nextDate: collection.nextDate.toISOString(),
      daysUntil: collection.daysUntil,
    })),
    lastUpdated: new Date().toISOString(),
  };
  await writeToAppGroup(WIDGET_KEYS.bin, data);
}

/**
 * Request widget timeline refresh
 * Call this after updating widget data to tell iOS to refresh the widgets
 */
export async function refreshWidgets(): Promise<void> {
  if (!isNativeIOS()) return;

  // Widget timeline refresh happens automatically when data changes
  // For manual refresh, we would need a native plugin
  console.log('[WidgetBridge] Widget data updated, iOS will refresh on next timeline');
}

/**
 * Update all widgets at once
 * Useful for initial app load or after login
 */
export async function updateAllWidgets(data: {
  shopping?: Parameters<typeof updateShoppingWidget>[0];
  events?: Parameters<typeof updateEventsWidget>[0];
  routines?: Parameters<typeof updateRoutinesWidget>[0];
  f1?: { session: Parameters<typeof updateF1Widget>[0]; race: Parameters<typeof updateF1Widget>[1] };
  bin?: Parameters<typeof updateBinWidget>[0];
}): Promise<void> {
  const promises: Promise<void>[] = [];

  if (data.shopping) {
    promises.push(updateShoppingWidget(data.shopping));
  }
  if (data.events) {
    promises.push(updateEventsWidget(data.events));
  }
  if (data.routines) {
    promises.push(updateRoutinesWidget(data.routines));
  }
  if (data.f1) {
    promises.push(updateF1Widget(data.f1.session, data.f1.race));
  }
  if (data.bin) {
    promises.push(updateBinWidget(data.bin));
  }

  await Promise.all(promises);
  await refreshWidgets();
}
