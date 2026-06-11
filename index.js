const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

exports.onSquadChatAdded = functions.firestore
    .document('Admin/Squads/SquadList/{squadId}/chats/{chatId}') 
    .onCreate(async (snapshot, context) => {
        
        const squadId = context.params.squadId;
        console.log(`📡 [CLOUD LOG] Sabon sako ya shigo a cikin Squad: ${squadId}`);

        const chatData = snapshot.data();
        if (!chatData) return null;

        const senderId = chatData.senderId;     
        const messageBody = chatData.message;   
        const senderName = chatData.senderName; 

        try {
            const usersSnapshot = await db.collection('Admin')
                                          .doc('Users')
                                          .collection('UsersList')
                                          .get();

            if (usersSnapshot.empty) return null;

            let tokensArray = [];
            usersSnapshot.forEach(userDoc => {
                const userData = userDoc.data();
                const uId = userDoc.id; 
                const fcmToken = userData.fcmToken;

                if (fcmToken && uId !== senderId) {
                    tokensArray.push(fcmToken);
                }
            });

            if (tokensArray.length === 0) return null;

            const payload = {
                tokens: tokensArray, 
                android: { priority: 'high' },
                data: {
                    title: `${senderName} (${squadId} Alert)`, 
                    body: messageBody,
                    channel_id: "squad_emergency_alerts_v2" 
                }
            };

            const response = await messaging.sendEachForMulticast(payload);
            console.log(`✅ [SUCCESS] An tura sanarwa ga jami'ai guda [${response.successCount}]!`);
            return null;

        } catch (error) {
            console.error("❌ [ERROR] Matsalar tura sanarwa:", error);
            return null;
        }
    });