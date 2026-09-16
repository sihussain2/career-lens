const DB_NAME = "careerLensDocuments";
const DB_VERSION = 1;
const STORE_NAME = "originalDocuments";

export interface StoredOriginalDocument {
  resumeId: string;
  type: "docx";
  filename: string;
  data: ArrayBuffer;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "resumeId"
        });
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () =>
      reject(
        request.error ??
          new Error("Unable to open CareerLens document storage.")
      );
  });
}

export async function saveOriginalDocx(
  resumeId: string,
  filename: string,
  data: ArrayBuffer
): Promise<void> {
  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    transaction.objectStore(STORE_NAME).put({
      resumeId,
      type: "docx",
      filename,
      data
    } satisfies StoredOriginalDocument);

    transaction.oncomplete = () => resolve();

    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("Unable to save the original DOCX.")
      );
  });

  db.close();
}

export async function getOriginalDocx(
  resumeId: string
): Promise<StoredOriginalDocument | null> {
  const db = await openDatabase();

  const result =
    await new Promise<StoredOriginalDocument | null>(
      (resolve, reject) => {
        const transaction = db.transaction(
          STORE_NAME,
          "readonly"
        );

        const request = transaction
          .objectStore(STORE_NAME)
          .get(resumeId);

        request.onsuccess = () =>
          resolve(request.result ?? null);

        request.onerror = () =>
          reject(
            request.error ??
              new Error("Unable to retrieve the original DOCX.")
          );
      }
    );

  db.close();

  return result;
}
