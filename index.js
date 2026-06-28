const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

console.log("\n=========================================================");
console.log("🚀 Server Setup: Combined Channel-Locked Mode Running!");
console.log("=========================================================\n");

try {
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
 * 📡 LISTENER 1: CHAT NOTIFICATIONS (Your Original Functional Setup)
 */
db.collectionGroup('chats')
  .onSnapshot(snapshot => {
    console.log(`📡 [LIVE LOG] Injin girgije ya ji motsi a Chats! Canje-canje: [${snapshot.docChanges().length}]`);

    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const chatData = change.doc.data();

            const docPath = change.doc.ref.path; 
            const pathParts = docPath.split('/');
            const dynamicSquadId = pathParts[3] || "Squad Alert"; 

            const senderId = chatData.senderId;     
            const messageBody = chatData.message;   
            const senderName = chatData.senderName; 

            console.log(`📥 [NEW CHAT] Squad: ${dynamicSquadId} | Daga: ${senderName}`);

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
                    const userActiveSquad = (userData.currentSquadId || "").toString().trim();

                    // Filter matching current chat room location exactly
                    if (fcmToken && String(uId).trim() !== String(senderId).trim() && userActiveSquad === String(dynamicSquadId).trim()) {
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

                const response = await messaging.sendEachForMulticast(payload);
                console.log(`✅ [CHAT SENT] Delivered chat notification alerts to [${response.successCount}] profiles.`);

            } catch (error) {
                console.error("❌ Matsalar tura sanarwa chat:", error);
            }
        }
    });
}, error => console.error("❌ Firestore Chat Listener Error:", error));


/**
 * 📡 LISTENER 2: RESTRICTED SQUAD SOUND ALERTS (Fixed Database Mapping Insertion)
 * Sends a custom sound channel strictly to active users inside the specified squad path
 */
db.collectionGroup('sound_alerts')
  .onSnapshot(snapshot => {
    console.log(`📡 [LIVE LOG] Restricted Sound alert triggered!`);
    
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const alertData = change.doc.data();
            
            const docPath = change.doc.ref.path; 
            const pathParts = docPath.split('/');
            
            // Extract and clean squad identity string safely
            const squadId = (alertData.squadId || pathParts[3] || "").toString().trim();
            const senderId = alertData.senderId;
            const titleText = alertData.title || "Squad Sound Alert!";

            if (!squadId) {
                console.log("⚠️ Sound alert missing 'squadId'. Skipping to avoid global broadcast.");
                return;
            }

            console.log(`🔔 [BOUNDED SOUND ALERT] Sending sound to Squad: ${squadId}`);

            try {
                // 🎯 PATH FIX: Follows your specific nested structure "Admin/Squads/SquadList/[id]/members"
                const squadMembersSnapshot = await db.collection('Admin')
                                                     .doc('Squads')
                                                     .collection('SquadList')
                                                     .doc(squadId)
                                                     .collection('members') // Explicit lowercase collection rule mapping
                                                     .get();

                if (squadMembersSnapshot.empty) {
                    console.log(`⚠️ No members found in subcollection path for squad: ${squadId}`);
                    return;
                }

                let memberIds = [];
                squadMembersSnapshot.forEach(doc => {
                    // Filter check: Convert to clean string to bypass string matching discrepancies 
                    if (String(doc.id).trim() !== String(senderId).trim()) {
                        memberIds.push(doc.id);
                    }
                });

                if (memberIds.length === 0) {
                    console.log("ℹ️ Broadcast cancelled: Sender is the only member inside this squad.");
                    return;
                }

                // Fetching corresponding FCM destination keys globally via cross-referenced UIDs
                let tokensArray = [];
                for (const uId of memberIds) {
                    const userDoc = await db.collection('Admin')
                                                  .doc('Users')
                                                  .collection('UsersList')
                                                  .doc(uId)
                                                  .get();
                    if (userDoc.exists && userDoc.data().fcmToken) {
                        tokensArray.push(userDoc.data().fcmToken);
                    }
                }

                if (tokensArray.length === 0) {
                    console.log("⚠️ Active squad members targeted lack valid registered fcmTokens.");
                    return;
                }

                // 🎯 FORMAT FIX: Standardized body configurations to keep notification alive when app is closed
                const payload = {
                    tokens: tokensArray,
                    android: {
                        priority: 'high',
                        notification: {
                            channelId: "custom_sound_channel_id", 
                            sound: 'my_custom_sound'
                        }
                    },
                    notification: {
                        title: titleText,
                        body: "🚨 Strategic sound alert broadcast update incoming!"
                    },
                    data: {
                        type: "sound_alert_only",
                        squadId: String(squadId)
                    }
                };

                const response = await messaging.sendEachForMulticast(payload);
                console.log(`✅ [SENT CHANNEL SOUND] Delivered strictly to [${response.successCount}] active squad members.`);
            } catch (error) {
                console.error("❌ Bounded sound alert delivery failed:", error);
            }
        }
    });
}, error => console.error("❌ Sound Listener Error:", error));


// Dummy Express server tracking setup to keep Render from sleeping
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send("Security Server Is Active 24/7 🚀"));
app.listen(PORT, () => console.log(`💻 Dummy Web Port active on: ${PORT}`));

// Keep-Awake routine
const axios = require('axios'); 
setInterval(async () => {
    try {
        const myServerUrl = 'https://smartai-6u70.onrender.com/'; 
        await axios.get(myServerUrl);
        console.log(`📡 [SELF-PING SUCCESS] Sabar tana a farke!`);
    } catch (error) {
        console.error(`⚠️ [SELF-PING ERROR]`, error.message);
    }
}, 5 * 60 * 1000);
