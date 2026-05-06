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
  // --- NEW: BEAUTIFUL UI FOR BROWSER VISITS (GET REQUESTS) ---
  if (req.method === "GET") {
    const htmlUI = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Secure IoT Webhook</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; color: #334155; }
          .container { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); text-align: center; max-width: 400px; border: 1px solid #e2e8f0; }
          .lock-icon { background: #eff6ff; color: #2563eb; width: 72px; height: 72px; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 24px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.06); }
          h1 { margin: 0 0 12px; font-size: 24px; color: #0f172a; letter-spacing: -0.5px; }
          p { margin: 0 0 24px; font-size: 15px; color: #64748b; line-height: 1.6; }
          .badge { display: inline-block; background: #dcfce7; color: #166534; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #bbf7d0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="lock-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1>Secure API Endpoint</h1>
          <p>This is a private server connection for the ParkMatic system. Direct browser access is restricted.</p>
          <span class="badge">IoT System Active</span>
        </div>
      </body>
      </html>
    `;
    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(htmlUI);
  }

  // Reject anything that isn't POST or GET
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // --- STANDARD IOT POST LOGIC (For Postman & ESP8266) ---
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

    // 2. ADD TO PARKING HISTORY (For the React Chart)
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
