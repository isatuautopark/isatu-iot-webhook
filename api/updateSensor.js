import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Vercel will securely inject your JSON key here
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Initialize Firebase Admin
if (!global.firebaseApp) {
  global.firebaseApp = initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();
const IOT_SECRET_KEY = "isatu_autopark_secret_2026";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const apiKey = req.headers["x-api-key"] || req.body.apiKey;
  if (apiKey !== IOT_SECRET_KEY) {
    return res.status(401).send("Unauthorized: Invalid API Key");
  }

  const { slotId, status, distance, deviceType } = req.body;

  if (!slotId || typeof status === "undefined") {
    return res.status(400).send("Bad Request: Missing slotId or status");
  }

  try {
    // 1. UPDATE THE LIVE PARKING SLOT
    await db
      .collection("parking_slots")
      .doc(slotId)
      .set(
        {
          status: status,
          distance: distance || "N/A",
          device_type: deviceType || "ESP8266",
          lastUpdated: FieldValue.serverTimestamp(),
          isOnline: true,
        },
        { merge: true },
      );

    // 2. NEW: ADD TO PARKING HISTORY (This is what the chart needs!)
    // We log it whenever a car parks (status 1)
    if (status === 1 || status === 2 || status === 3) {
      await db.collection("parking_history").add({
        slotId: slotId,
        event:
          status === 1
            ? "OCCUPIED"
            : status === 2
              ? "RESERVED"
              : "UNAUTHORIZED",
        timestamp: FieldValue.serverTimestamp(),
      });
    }

    return res
      .status(200)
      .send(`Slot ${slotId} updated to ${status} and logged in history.`);
  } catch (error) {
    console.error("Database Error:", error);
    return res.status(500).send("Internal Server Error");
  }
}
