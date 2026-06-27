const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

console.log("\n=========================================================");
console.log("🚀 Server din Jami'ai na Girgije Ya Tashi! (ALL SQUADS MODE)");
console.log("=========================================================\n");

try {
    const jsonPath = path.resolve(__dirname, 'smartsafetyai-c608e-firebase-adminsdk-fbsvc-bdb400ad00.json');
    console.log(`🔍 Neman fayil din JSON a: ${jsonPath}`);
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const serviceAccount = JSON.parse(rawData);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (err) {
    console.error("❌ Kuskure wajen karanta fayil din JSON:", err.message);
    process.exit(1); 
}

const db = admin.firestore();
const messaging = admin.messaging();

// ⏰ Muna kiyaye lokacin da sabar ta tashi domin tace tsofaffin sakonni
const serverStartTime = admin.firestore.Timestamp.now();
console.log(`⏰ Lokacin Kunna Sabar (Server Start Time): ${serverStartTime.toDate().toISOString()}`);

/**
 * 📡 GLOBAL COLLECTION GROUP LISTENER WITH TIMESTAMP FILTER
 * (Sauraron sababbin sakonni kawai daga lokacin da sabar ta tashi zuwa gaba)
 */
db.collectionGroup('chats')
  .where('timestamp', '>=', serverStartTime)
  .onSnapshot(snapshot => {
    if (snapshot.empty) return;

    console.log(`📡 [LIVE LOG] Sabon motsi ya shigo canje-canje: [${snapshot.docChanges().length}]`);
    
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const chatData = change.doc.data();
            
            const docPath = change.doc.ref.path; 
            const pathParts = docPath.split('/');
            const dynamicSquadId = pathParts[3] || "Squad Alert"; 

            const senderId = chatData.senderId;     
            const messageBody = chatData.message;   
            const senderName = chatData.senderName; 

            console.log(`📥 [NEW ALERT] Squad: ${dynamicSquadId} | Daga: ${senderName} | Sako: ${messageBody}`);

            try {
                const usersSnapshot = await db.collection('Admin')
                                              .doc('Users')
                                              .collection('UsersList')
                                              .get();

                if (usersSnapshot.empty) return;

                let tokensArray = [];
                usersSnapshot.forEach(userDoc => {
                    const userData = userDoc.data();
                    const uId = userDoc.id; 
                    const fcmToken = userData.fcmToken;

                    if (fcmToken && uId !== senderId) {
                        tokensArray.push(fcmToken);
                    }
                });

                if (tokensArray.length === 0) return;

                // Saita saƙon da tsarin Firebase Console da na Data Payload duka biyu
                const payload = {
                    tokens: tokensArray, 
                    android: {
                        priority: 'high',
                        notification: {
                            channelId: process.env.NOTIFICATION_CHANNEL_ID || "squad_emergency_alerts_v2",
                            sound: 'default'
                        }
                    },
                    notification: {
                        title: `${senderName} (${dynamicSquadId})`, 
                        body: messageBody
                    },
                    data: {
                        senderName: String(senderName),
                        message: String(messageBody),
                        squadId: String(dynamicSquadId)
                    }
                };

                const response = await messaging.sendEachForMulticast(payload);
                console.log(`✅ [SENT] An tura sanarwa ta girgije ga jami'ai [${response.successCount}]!`);

            } catch (error) {
                console.error("❌ Matsalar tura sanarwa:", error);
            }
        }
    });
}, error => {
    console.error("❌ Firestore Listener Error:", error);
});

// Dummy Express server don kiyaye Render kada ta mutu
const express = require('express');
const app = express();

// 🛡️ INJIN KARIYA DAGA BARCI (SELF-PING TO PREVENT RENDER SLEEP)
const axios = require('axios'); // ko amfani da https na gida

setInterval(async () => {
    try {
        // Sauya wannan zuwa ainihin cikakken Link dinka na Render!
        const myServerUrl = 'https://smartai.onrender.com'; 
        
        console.log(`📡 [SELF-PING] Muna taba sabar kanmu don hana barci...`);
        await axios.get(myServerUrl);
        console.log(`✅ [SELF-PING SUCCESS] Sabar tana a farke!`);
    } catch (error) {
        console.error(`⚠️ [SELF-PING ERROR] Ba a sami sabar ba:`, error.message);
    }
}, 5 * 60 * 1000); // Kowane Minti 5 (5 minutes)
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send("Sentinel Security Server Is Active 24/7 🚀"));
app.listen(PORT, () => console.log(`💻 Dummy Web Port yana kunne a: ${PORT}`));
