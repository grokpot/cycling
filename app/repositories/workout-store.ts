/** IndexedDB persistence for profiles, workouts, songs, plans, and rides. */

import {
  DEFAULT_RPE_TABLE,
  DEFAULT_ZONE_TABLE,
} from '#shared/targets'
import type { Plan, Profile, Ride, Song, Workout } from '#shared/types'

const DB_NAME = 'cycling'
const DB_VERSION = 1

type StoreName = 'profiles' | 'workouts' | 'songs' | 'plans' | 'rides'

function defaultProfile(): Profile {
  return {
    id: 'default',
    ftp: null,
    preferredCadence: 80,
    zoneTable: { ...DEFAULT_ZONE_TABLE },
    rpeTable: { ...DEFAULT_RPE_TABLE },
    genres: [],
  }
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function openDb(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === 'undefined') {
    return null
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of [
        'profiles',
        'workouts',
        'songs',
        'plans',
        'rides',
      ] as const) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (os: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const dbPromise = openDb()
  if (!dbPromise) {
    return null
  }
  const db = await dbPromise
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const os = tx.objectStore(store)
    const req = fn(os)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getProfile(): Promise<Profile> {
  const existing = await withStore<Profile>('profiles', 'readonly', (os) =>
    os.get('default'),
  )
  if (existing) {
    return existing
  }
  const profile = defaultProfile()
  await withStore('profiles', 'readwrite', (os) => os.put(profile))
  return profile
}

export async function saveProfile(profile: Profile): Promise<void> {
  await withStore('profiles', 'readwrite', (os) => os.put(plain(profile)))
}

export async function listWorkouts(): Promise<Workout[]> {
  const rows =
    (await withStore<Workout[]>('workouts', 'readonly', (os) =>
      os.getAll(),
    )) ?? []
  return rows.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function getWorkout(id: string): Promise<Workout | null> {
  return (
    (await withStore<Workout>('workouts', 'readonly', (os) => os.get(id))) ??
    null
  )
}

export async function saveWorkout(workout: Workout): Promise<void> {
  await withStore('workouts', 'readwrite', (os) => os.put(plain(workout)))
}

export async function listSongs(): Promise<Song[]> {
  return (
    (await withStore<Song[]>('songs', 'readonly', (os) => os.getAll())) ?? []
  )
}

export async function saveSong(song: Song): Promise<void> {
  await withStore('songs', 'readwrite', (os) => os.put(plain(song)))
}

export async function savePlan(plan: Plan): Promise<void> {
  await withStore('plans', 'readwrite', (os) => os.put(plain(plan)))
}

export async function getPlan(id: string): Promise<Plan | null> {
  return (
    (await withStore<Plan>('plans', 'readonly', (os) => os.get(id))) ?? null
  )
}

export async function getPlanForWorkout(
  workoutId: string,
): Promise<Plan | null> {
  const plans =
    (await withStore<Plan[]>('plans', 'readonly', (os) => os.getAll())) ?? []
  return (
    plans
      .filter((p) => p.workoutId === workoutId)
      .sort(
        (a, b) =>
          (b as Plan & { savedAt?: string }).savedAt?.localeCompare(
            (a as Plan & { savedAt?: string }).savedAt ?? '',
          ) ?? 0,
      )[0] ?? null
  )
}

export async function saveRide(ride: Ride): Promise<void> {
  await withStore('rides', 'readwrite', (os) => os.put(plain(ride)))
}

const folderHandles = new Map<string, FileSystemDirectoryHandle>()

export function setFolderHandle(key: string, handle: FileSystemDirectoryHandle) {
  folderHandles.set(key, handle)
}

export function getFolderHandle(key: string): FileSystemDirectoryHandle | undefined {
  return folderHandles.get(key)
}

export function useWorkoutStore() {
  const ready = useState('workout-store-ready', () => false)

  onMounted(async () => {
    if (!ready.value) {
      await getProfile()
      ready.value = true
    }
  })

  return {
    ready,
    getProfile,
    saveProfile,
    listWorkouts,
    getWorkout,
    saveWorkout,
    listSongs,
    saveSong,
    savePlan,
    getPlan,
    getPlanForWorkout,
    saveRide,
    setFolderHandle,
    getFolderHandle,
  }
}