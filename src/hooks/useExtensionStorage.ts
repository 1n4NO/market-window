import { useSyncExternalStore } from 'react';
import {
  getDefaultStorageController,
  type ExtensionStorageController,
  type StorageSnapshot,
} from '../services/storage/extensionStorage';

export function useExtensionStorageController(
  controller: ExtensionStorageController = getDefaultStorageController(),
): ExtensionStorageController {
  return controller;
}

export function useExtensionStorageSnapshot(
  controller: ExtensionStorageController = getDefaultStorageController(),
): StorageSnapshot {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

export function useExtensionStorage(
  controller: ExtensionStorageController = getDefaultStorageController(),
): { controller: ExtensionStorageController; snapshot: StorageSnapshot } {
  const snapshot = useExtensionStorageSnapshot(controller);
  return { controller, snapshot };
}
