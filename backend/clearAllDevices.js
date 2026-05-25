const { initializeFirebase } = require("./firebase");

async function deleteDocumentRecursively(docRef) {
  const collections = await docRef.listCollections();
  for (const collectionRef of collections) {
    const snapshot = await collectionRef.get();
    for (const childDoc of snapshot.docs) {
      await deleteDocumentRecursively(childDoc.ref);
    }
  }

  await docRef.delete();
}

async function deleteCollectionDocuments(collectionRef) {
  const snapshot = await collectionRef.get();
  if (snapshot.empty) {
    return;
  }

  const deletePromises = snapshot.docs.map(async (docSnap) => {
    await deleteDocumentRecursively(docSnap.ref);
  });

  await Promise.all(deletePromises);
}

async function main() {
  const { firestore } = initializeFirebase();

  console.log("Starting full device cleanup...");

  const usersSnapshot = await firestore.collection("users").get();
  if (usersSnapshot.empty) {
    console.log("No users found in Firestore.");
  }

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const devicesRef = firestore.collection("users").doc(userId).collection("devices");
    const devicesSnapshot = await devicesRef.get();

    if (devicesSnapshot.empty) {
      console.log(`No device docs found for user ${userId}.`);
      continue;
    }

    console.log(`Deleting ${devicesSnapshot.size} devices for user ${userId}...`);
    for (const deviceDoc of devicesSnapshot.docs) {
      await deleteDocumentRecursively(deviceDoc.ref);
    }
  }

  const rootDevicesRef = firestore.collection("devices");
  const rootDevicesSnapshot = await rootDevicesRef.get();
  if (rootDevicesSnapshot.empty) {
    console.log("No root devices found.");
  } else {
    console.log(`Deleting ${rootDevicesSnapshot.size} root device docs...`);
    for (const deviceDoc of rootDevicesSnapshot.docs) {
      await deleteDocumentRecursively(deviceDoc.ref);
    }
  }

  console.log("Device cleanup completed.");
}

main().catch((err) => {
  console.error("Failed to clear all devices:", err);
  process.exit(1);
});
