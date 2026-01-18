/**
 * Script to consolidate paper_sessions in Firebase
 * Run this once to merge multiple session documents per user-paper pair into one
 * 
 * Usage: node consolidate-sessions.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';

// Firebase config - replace with your actual config
const firebaseConfig = {
    // Copy from your lib/firebase.ts
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function consolidateSessions() {
    console.log('Starting session consolidation...');

    try {
        // Fetch all sessions
        const sessionsSnap = await getDocs(collection(db, 'paper_sessions'));
        const sessions = sessionsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`Found ${sessions.length} total sessions`);

        // Group by user_id + paper_id
        const grouped = new Map();
        sessions.forEach(session => {
            const key = `${session.user_id}_${session.paper_id}`;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(session);
        });

        console.log(`Found ${grouped.size} unique user-paper pairs`);

        // Process each group
        let consolidatedCount = 0;
        const batch = writeBatch(db);
        let batchCount = 0;

        for (const [key, sessionGroup] of grouped.entries()) {
            if (sessionGroup.length === 1) {
                // Already consolidated, skip
                continue;
            }

            // Calculate total duration
            const totalDuration = sessionGroup.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

            // Keep the first session, update its duration
            const primarySession = sessionGroup[0];
            const primaryRef = doc(db, 'paper_sessions', primarySession.id);

            batch.update(primaryRef, {
                duration_seconds: totalDuration,
                last_updated: new Date().toISOString()
            });

            // Delete the rest
            for (let i = 1; i < sessionGroup.length; i++) {
                const sessionRef = doc(db, 'paper_sessions', sessionGroup[i].id);
                batch.delete(sessionRef);
            }

            consolidatedCount++;
            batchCount += sessionGroup.length;

            console.log(`Consolidated ${sessionGroup.length} sessions for ${key} (total: ${totalDuration}s)`);

            // Commit batch every 500 operations (Firestore limit)
            if (batchCount >= 400) {
                await batch.commit();
                console.log('Batch committed');
                batchCount = 0;
            }
        }

        // Commit remaining operations
        if (batchCount > 0) {
            await batch.commit();
            console.log('Final batch committed');
        }

        console.log(`\nConsolidation complete!`);
        console.log(`- Consolidated ${consolidatedCount} user-paper pairs`);
        console.log(`- Check your Firebase console to verify`);

    } catch (error) {
        console.error('Error consolidating sessions:', error);
    }
}

consolidateSessions();
