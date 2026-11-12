import { CustomSample, Experiment } from '../types';

const DB_NAME = 'SignalLabEducationalDB';
const DB_VERSION = 1;
const STORE_EXPERIMENTS = 'experiments';
const STORE_SAMPLES = 'samples';

/** localStorage fallback helpers — never throw (private mode, quota, corrupted JSON). */
function readFallback<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallback(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_EXPERIMENTS)) {
        db.createObjectStore(STORE_EXPERIMENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SAMPLES)) {
        db.createObjectStore(STORE_SAMPLES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllExperiments(): Promise<Experiment[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_EXPERIMENTS, 'readonly');
      const store = tx.objectStore(STORE_EXPERIMENTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readFallback('signallab_experiments_fallback');
  }
}

export async function saveExperimentToDB(experiment: Experiment): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_EXPERIMENTS, 'readwrite');
      const store = tx.objectStore(STORE_EXPERIMENTS);
      const req = store.put(experiment);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = await getAllExperiments();
    const idx = list.findIndex((e) => e.id === experiment.id);
    if (idx >= 0) list[idx] = experiment;
    else list.push(experiment);
    writeFallback('signallab_experiments_fallback', list);
  }
}

export async function deleteExperimentFromDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_EXPERIMENTS, 'readwrite');
      const store = tx.objectStore(STORE_EXPERIMENTS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = await getAllExperiments();
    const filtered = list.filter((e) => e.id !== id);
    writeFallback('signallab_experiments_fallback', filtered);
  }
}

export async function getAllSamples(): Promise<CustomSample[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAMPLES, 'readonly');
      const store = tx.objectStore(STORE_SAMPLES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readFallback('signallab_samples_fallback');
  }
}

export async function saveSampleToDB(sample: CustomSample): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAMPLES, 'readwrite');
      const store = tx.objectStore(STORE_SAMPLES);
      const req = store.put(sample);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = await getAllSamples();
    const idx = list.findIndex((s) => s.id === sample.id);
    if (idx >= 0) list[idx] = sample;
    else list.push(sample);
    writeFallback('signallab_samples_fallback', list);
  }
}

export async function deleteSampleFromDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAMPLES, 'readwrite');
      const store = tx.objectStore(STORE_SAMPLES);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = await getAllSamples();
    const filtered = list.filter((s) => s.id !== id);
    writeFallback('signallab_samples_fallback', filtered);
  }
}
