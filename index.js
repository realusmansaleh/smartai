const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

console.log("\n=========================================================");
console.log("🚀 Server is running with Strict Background Fix!");
console.log("=========================================================\n");

try {
    const jsonPath = path.join(__dirname, 'smartsafetyai-c608e-firebase-adminsdk-fbsvc-bdb400ad00.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const serviceAccount = JSON.parse(rawData);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (err) {
    console.error("❌ JSON Error:", err.message);
    process.exit(1); 
}

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * 📡 LISTENER 1: CHAT NOTIFICATIONS (Your Original Working Logic)
 */
db.collectionGroup('chats')
  .onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const chatData = change.doc.data();
            const docPath = change.doc.ref.path; 
            const pathParts = docPath.split('/');
            const dynamicSquadId = (pathParts[3] || "").toString().trim(); 

            const senderId = chatData.senderId;     
            const messageBody = chatData.message;   
            const senderName = chatData.senderName; 

            try {
                const usersSnapshot = await db.collection('Admin').doc('Users').collection('UsersList').get();
                if (usersSnapshot.empty) return;

                let tokensArray = [];
                usersSnapshot.forEach(userDoc => {
                    const userData = userDoc.data();
                    const uId = userDoc.id; 
                    const fcmToken = userData.fcmToken;
                    const userActiveSquad = (userData.currentSquadId || "").toString().trim();

                    // Strict filter: Same squad, not sender
                    if (fcmToken && String(uId).trim() !== String(senderId).trim() && userActiveSquad === dynamicSquadId) {
                        tokensArray.push(fcmToken);
                    }
                });

                if (tokensArray.length === 0) return;

                const payload = {
                    tokens: tokensArray, 
                    notification: {
                        title: `New Message From ${senderName}`, 
                        body: messageBody
                    },
                    data: {
                        senderName: String(senderName),
                        message: String(messageBody),
                        squadId: String(dynamicSquadId)
                    }
                };

                await messaging.sendEachForMulticast(payload);
                console.log(`✅ [CHAT SENT] Delivered to background squad members.`);
            } catch (error) {
                console.error("❌ Chat notification failed:", error);
            }
        }
    });
}, error => console.error(error));


/**
 * 📡 LISTENER 2: STRICT CHANNEL-LOCKED SOUND ALERTS (Clean Format Fix)
 */
db.collectionGroup('sound_alerts')
  .onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const alertData = change.doc.data();
            const docPath = change.doc.ref.path; 
            const pathParts = docPath.split('/');
            const dynamicSquadId = (alertData.squadId || pathParts[3] || "").toString().trim(); 

            const senderId = alertData.senderId;
            const titleText = alertData.title || "🚨 EMERGENCY SQUAD AUDIO PING";

            try {
                const usersSnapshot = await db.collection('Admin').doc('Users').collection('UsersList').get();
                if (usersSnapshot.empty) return;

                let tokensArray = [];
                usersSnapshot.forEach(userDoc => {
                    const userData = userDoc.data();
                    const uId = userDoc.id; 
                    const fcmToken = userData.fcmToken;
                    const userActiveSquad = (userData.currentSquadId || "").toString().trim();

                    // Strict filter: Same squad, not sender
                    if (fcmToken && String(uId).trim() !== String(senderId).trim() && userActiveSquad === dynamicSquadId) {
                        tokensArray.push(fcmToken);
                    }
                });

                if (tokensArray.length === 0) return;

                // 🎯 MATCHES YOUR CHAT STRUCTURE 1:1 TO FORWARD TO BACKGROUND
                const payload = {
                    tokens: tokensArray,
                    notification: {
                        title: titleText,
                        body: "Tap to view squad emergency alert panel."
                    },
                    data: {
                        type: "sound_alert_only",
                        squadId: String(dynamicSquadId)
                    }
                };

                await messaging.sendEachForMulticast(payload);
                console.log(`✅ [SOUND SENT] Channel-locked audio alert delivered successfully.`);
            } catch (error) {
                console.error("❌ Sound alert delivery failed:", error);
            }
        }
    });
}, error => console.error(error));


// Dummy Express server to keep Render alive
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send("Security Server Is Active 🚀"));
app.listen(PORT, () => console.log(`💻 Port active on: ${PORT}`));

// Keep-awake ping
const axios = require('axios');
setInterval(async () => {
    try {
        await axios.get('https://smartai-6u70.onrender.com/');
    } catch (error) {
        console.log(`Keep-alive tracking check.`);
    }
}, 5 * 60 * 1000);
