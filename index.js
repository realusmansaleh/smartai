const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

console.log("\n=========================================================");
console.log("🚀 Server din Jami'ai na Girgije Ya Tashi! (ALL SQUADS MODE)");
console.log("=========================================================\n");

try {
    // Tabbatar sunan fayil dinka na JSON ya dace da wannan dake kasa
    const jsonPath = path.join(__dirname, 'smartsafetyai-c608e-firebase-adminsdk-fbsvc-bdb400ad00.json');
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

/**
 * 📡 GLOBAL COLLECTION GROUP LISTENER (Sauraron Duka Rukunoni 24/7)
 */
db.collectionGroup('chats')
  .onSnapshot(snapshot => {
    console.log(`📡 [LIVE LOG] Injin girgije ya ji motsi a Firestore! Canje-canje: [${snapshot.docChanges().length}]`);
    
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

                const payload = {
    tokens: tokensArray, 
    android: {
        priority: 'high',
        notification: {
            channelId: process.env.NOTIFICATION_CHANNEL_ID || "squad_emergency_alerts_v2",
            sound: 'default'
        }
    },
    // Wannan na saman allo (kamar na Firebase Console)
    notification: {
        title: `You have recieived Message From ${senderName}`, 
        body: messageBody
    },
    // Wannan shi ne ainihin data payload dake tafiya kai-tsaye cikin kudin Android dinka
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
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send("Sentinel Security Server Is Active 24/7 🚀"));
app.listen(PORT, () => console.log(`💻 Dummy Web Port yana kunne a: ${PORT}`));
