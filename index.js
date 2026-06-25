const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

console.log("\n=========================================================");
console.log("🚀 Server ya tafara aiki! (MULTIPLE LISTENERS MODE)");
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

// Helper to fetch user token
async function getUserToken(userId) {
    try {
        const userDoc = await db.collection('Admin').doc('Users').collection('UsersList').doc(userId).get();
        if (userDoc.exists) {
            return userDoc.data().fcmToken || null;
        }
    } catch (e) {
        console.error(`❌ Error fetching token for user ${userId}:`, e);
    }
    return null;
}

/**
 * 📡 LISTENER 1: GLOBAL CHATS (Your original working code)
 */
db.collectionGroup('chats')
  .onSnapshot(snapshot => {
    console.log(`📡 [LIVE LOG] Injin chats ya ji motsi! Canje-canje: [${snapshot.docChanges().length}]`);
    
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const chatData = change.doc.data();
            const docPath = change.doc.ref.path; 
            const pathParts = docPath.split('/');
            const dynamicSquadId = pathParts[3] || "Squad Alert"; 

            const senderId = chatData.senderId;     
            const messageBody = chatData.message;   
            const senderName = chatData.senderName; 

            console.log(`📥 [NEW CHAT ALERT] Squad: ${dynamicSquadId} | Daga: ${senderName}`);

            try {
                const usersSnapshot = await db.collection('Admin').doc('Users').collection('UsersList').get();
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
                console.log(`✅ [SENT CHAT] An tura sanarwa [${response.successCount}]!`);
            } catch (error) {
                console.error("❌ Matsalar tura sanarwa:", error);
            }
        }
    });
}, error => console.error("❌ Chats Listener Error:", error));
/**
 * 📡 LISTENER 2: STRICT CHANNEL-LOCKED SOUND ALERTS
 * Only delivers to users whose currentSquadId matches the alert's squadId.
 */
db.collectionGroup('sound_alerts')
  .onSnapshot(snapshot => {
    console.log(`📡 [LIVE LOG] Strict Sound alert listener triggered!`);
    
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const alertData = change.doc.data();
            
            const docPath = change.doc.ref.path; 
            const pathParts = docPath.split('/');
            
            // Extract squad ID and clean it up immediately
            const dynamicSquadId = (alertData.squadId || pathParts[3] || "").toString().trim(); 

            const senderId = alertData.senderId;
            const titleText = alertData.title || "🚨 EMERGENCY SQUAD AUDIO PING";

            if (!dynamicSquadId) {
                console.log("⚠️ Could not resolve squadId for this alert. Dropping to prevent global leak.");
                return;
            }

            console.log(`🔔 [LOCKED SOUND ALERT] Squad Target: "${dynamicSquadId}" | Sender: ${senderId}`);

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

                    // Clean up the user's active squad string from database to ensure exact match
                    const userActiveSquad = (userData.currentSquadId || "").toString().trim();

                    // STRICT FILTER RULES:
                    // 1. Must have a valid device token
                    // 2. Must NOT be the sender
                    // 3. Their current active room MUST exactly match the alert room
                    if (fcmToken && uId !== senderId && userActiveSquad === dynamicSquadId) {
                        tokensArray.push(fcmToken);
                    }
                });

                if (tokensArray.length === 0) {
                    console.log(`ℹ️ Sound alert dropped: No online matching members found inside room "${dynamicSquadId}".`);
                    return;
                }

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
                        title: titleText
                    },
                    data: {
                        type: "sound_alert_only",
                        squadId: String(dynamicSquadId)
                    }
                };

                const response = await messaging.sendEachForMulticast(payload);
                console.log(`✅ [SENT LOCKED SOUND] Delivered strictly to [${response.successCount}] users inside ${dynamicSquadId}!`);
            } catch (error) {
                console.error("❌ Locked sound alert delivery failed:", error);
            }
        }
    });
}, error => console.error("❌ Sound Listener Error:", error));
 * 📡 LISTENER 3: ONE-TO-ONE FRIEND ALERTS (Feature 2)
 * Sends an alert specifically to one selected user doc
 */
db.collectionGroup('friend_alerts')
  .onSnapshot(snapshot => {
    console.log(`📡 [LIVE LOG] Friend alerts listener triggered! [${snapshot.docChanges().length}]`);
    
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const alertData = change.doc.data();
            const receiverId = alertData.receiverId; 
            const senderName = alertData.senderName || "A Friend";
            const alertTitle = alertData.title || `Alert from ${senderName}`;

            if (!receiverId) {
                console.log("⚠️ Friend alert document missing critical 'receiverId'. skipping.");
                return;
            }

            console.log(`🎯 [TARGETED ALERT] Sending friend alert to target User UUID: ${receiverId}`);

            try {
                const targetToken = await getUserToken(receiverId);

                if (!targetToken) {
                    console.log(`⚠️ Target user ${receiverId} does not have a live FCM Token registration.`);
                    return;
                }

                const payload = {
                    token: targetToken, // Using single send payload object structure here
                    android: {
                        priority: 'high',
                        notification: {
                            channelId: "friend_alerts_channel",
                            sound: 'default'
                        }
                    },
                    notification: {
                        title: alertTitle,
                        body: `${senderName} flagged an attention request.`
                    },
                    data: {
                        senderName: String(senderName),
                        type: "friend_direct_alert"
                    }
                };

                const response = await messaging.send(payload);
                console.log(`✅ [SENT FRIEND ALERT] Delivered safely to single client device. Message ID: ${response}`);
            } catch (error) {
                console.error("❌ Friend direct alert tracking failed:", error);
            }
        }
    });
}, error => console.error("❌ Friend Listener Error:", error));


// Dummy Express server don kiyaye Render kada ta mutu
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send("Security Server Is Active 24/7 🚀"));
app.listen(PORT, () => console.log(`💻 Dummy Web Port yana kunne a: ${PORT}`));

// 🛡️ INJIN KARIYA DAGA BARCI (SELF-PING TO PREVENT RENDER SLEEP)
const axios = require('axios');
setInterval(async () => {
    try {
        const myServerUrl = 'https://smartai-6u70.onrender.com/'; 
        console.log(`📡 [SELF-PING] Muna taba sabar kanmu don hana barci...`);
        await axios.get(myServerUrl);
        console.log(`✅ [SELF-PING SUCCESS] Sabar tana a farke!`);
    } catch (error) {
        console.error(`⚠️ [SELF-PING ERROR] Ba a sami sabar ba:`, error.message);
    }
}, 5 * 60 * 1000);
