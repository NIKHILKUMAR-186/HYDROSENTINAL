// Lightweight safe wrappers around Firestore calls to avoid runtime crashes
// when Firebase is not configured (e.g., local dev without VITE_FIREBASE_* envs).
// These wrappers prefer calling the real Firestore functions when available
// but return safe no-op or mock values when Firestore `db` is not present.

import {
  doc as realDoc,
  collection as realCollection,
  getDoc as realGetDoc,
  setDoc as realSetDoc,
  updateDoc as realUpdateDoc,
  deleteDoc as realDeleteDoc,
  onSnapshot as realOnSnapshot,
  query as realQuery,
  getDocs as realGetDocs,
  DocumentSnapshot,
} from "firebase/firestore";

type AnyRef = any;

const makeMockRef = (parts: any[]) => ({ __mock: true, _path: parts.join("/") });

export function docSafe(db: any, ...pathParts: any[]): AnyRef {
  try {
    if (db) return realDoc(db, ...pathParts);
  } catch (_) {}
  return makeMockRef(pathParts);
}

export function collectionSafe(db: any, ...pathParts: any[]): AnyRef {
  try {
    if (db) return realCollection(db, ...pathParts);
  } catch (_) {}
  return makeMockRef(pathParts);
}

function makeMockSnapshot(ref: AnyRef) {
  return {
    exists: () => false,
    data: () => undefined,
    id: ref && ref._path ? String(ref._path).split("/").pop() : undefined,
    ref,
  } as DocumentSnapshot;
}

export async function getDocSafe(refOrDb: any, ...maybePath: any[]) {
  try {
    // Called as getDocSafe(docRef) or getDocSafe(db, 'collection', 'id')
    if (maybePath && maybePath.length > 0) {
      const ref = docSafe(refOrDb, ...maybePath);
      if (ref && ref.__mock) return makeMockSnapshot(ref);
      return await realGetDoc(ref);
    }

    const ref = refOrDb;
    if (ref && ref.__mock) return makeMockSnapshot(ref);
    return await realGetDoc(ref);
  } catch (e) {
    return makeMockSnapshot({ __mock: true, _path: "unknown" });
  }
}

export async function getDocsSafe(queryOrRef: any) {
  try {
    if (queryOrRef && queryOrRef.__mock) {
      return {
        docs: [],
        size: 0,
        empty: true,
        forEach: () => {},
      };
    }
    return await realGetDocs(queryOrRef);
  } catch (e) {
    return {
      docs: [],
      size: 0,
      empty: true,
      forEach: () => {},
    };
  }
}

export function querySafe(...args: any[]) {
  try {
    if (args.some((value) => value && value.__mock)) {
      return { __mock: true, _path: args.map((arg) => arg && arg._path ? arg._path : String(arg)).join("|") };
    }
    return realQuery(...args);
  } catch (e) {
    return { __mock: true, _path: "unknown-query" };
  }
}

export async function setDocSafe(refOrDb: any, ...rest: any[]) {
  try {
    // setDocSafe(ref, data, options?) OR setDocSafe(db, 'col', 'id', data)
    if (rest.length >= 2 && rest[0] !== undefined && typeof rest[0] === 'object') {
      // probably setDocSafe(ref, data, opts)
      const [data, opts] = rest;
      if (refOrDb && refOrDb.__mock) return Promise.resolve();
      return await realSetDoc(refOrDb, data, opts);
    }

    // path-style call
    const data = rest.pop();
    const ref = docSafe(refOrDb, ...rest);
    if (ref && ref.__mock) return Promise.resolve();
    return await realSetDoc(ref, data);
  } catch (e) {
    return Promise.resolve();
  }
}

export async function updateDocSafe(refOrDb: any, ...rest: any[]) {
  try {
    if (rest.length === 0) return Promise.resolve();
    const data = rest[0];
    if (refOrDb && refOrDb.__mock) return Promise.resolve();
    return await realUpdateDoc(refOrDb, data);
  } catch (e) {
    return Promise.resolve();
  }
}

export async function deleteDocSafe(refOrDb: any, ...maybePath: any[]) {
  try {
    if (maybePath && maybePath.length > 0) {
      const ref = docSafe(refOrDb, ...maybePath);
      if (ref && ref.__mock) return Promise.resolve();
      return await realDeleteDoc(ref);
    }
    if (refOrDb && refOrDb.__mock) return Promise.resolve();
    return await realDeleteDoc(refOrDb);
  } catch (e) {
    return Promise.resolve();
  }
}

export function onSnapshotSafe(refOrDb: any, ...args: any[]) {
  try {
    // onSnapshot(ref, callbacks...)
    if (refOrDb && refOrDb.__mock) {
      const callbacks = args;
      // call the next callback with a mock snapshot immediately
      const cb = callbacks && callbacks[0];
      if (typeof cb === 'function') {
        try { cb(makeMockSnapshot(refOrDb)); } catch {}
      }
      return () => {};
    }

    return realOnSnapshot(refOrDb, ...args);
  } catch (e) {
    try {
      const cb = args && args[0];
      if (typeof cb === 'function') cb(makeMockSnapshot({ __mock: true, _path: 'unknown' }));
    } catch {}
    return () => {};
  }
}

export default {
  docSafe,
  collectionSafe,
  getDocSafe,
  getDocsSafe,
  querySafe,
  setDocSafe,
  updateDocSafe,
  deleteDocSafe,
  onSnapshotSafe,
};
