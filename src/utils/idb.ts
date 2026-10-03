import { CustomSample, Experiment } from '../types';

const DB_NAME = 'SignalLabEducationalDB';
const DB_VERSION = 1;
const STORE_EXPERIMENTS = 'experiments';
const STORE_SAMPLES = 'samples';

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
    const raw = localStorage.getItem('signallab_experiments_fallback');
    return raw ? JSON.parse(raw) : [];
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
    localStorage.setItem('signallab_experiments_fallback', JSON.stringify(list));
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
    localStorage.setItem('signallab_experiments_fallback', JSON.stringify(filtered));
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
    const raw = localStorage.getItem('signallab_samples_fallback');
    return raw ? JSON.parse(raw) : [];
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
    localStorage.setItem('signallab_samples_fallback', JSON.stringify(list));
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
    localStorage.setItem('signallab_samples_fallback', JSON.stringify(filtered));
  }
}
