const cron = require('node-cron');
const sessionModel = require('../models/session.model');
const offerModel = require('../models/offer.model');
const applicationModel = require('../models/application.model');
const attemptModel = require('../models/attempt.model');
const userModel = require('../models/user.model');
const { ATTEMPT_STATUSES, APPLICATION_STATUSES } = require('../models/enums');
const { notifySessionStartingSoon } = require('./notifications');

// Track which (sessionId, candidateId) pairs we already pinged for the upcoming-window reminder.
const remindedPairs = new Set();

/**
 * Every 10 minutes, find sessions whose startAt is within the next 30 min,
 * and email candidates that have applied/invited but not yet started.
 */
async function sendUpcomingSessionReminders() {
    try {
        const now = new Date();
        const horizon = new Date(now.getTime() + 30 * 60 * 1000);

        const upcoming = await sessionModel
            .find({ startAt: { $gte: now, $lte: horizon } })
            .lean();

        for (const session of upcoming) {
            const offer = await offerModel.findById(session.offerId).lean();
            if (!offer) continue;

            const apps = await applicationModel
                .find({
                    offerId: session.offerId,
                    status: {
                        $in: [APPLICATION_STATUSES.APPLIED, APPLICATION_STATUSES.INVITED],
                    },
                })
                .lean();

            for (const app of apps) {
                const key = `${session._id}:${app.candidateId}`;
                if (remindedPairs.has(key)) continue;

                const attempt = await attemptModel.findOne({
                    offerId: session.offerId,
                    candidateId: app.candidateId,
                });
                if (
                    attempt &&
                    attempt.status !== ATTEMPT_STATUSES.NOT_STARTED
                ) {
                    continue;
                }

                const candidate = await userModel.findById(app.candidateId).lean();
                if (!candidate?.email) continue;

                await notifySessionStartingSoon(candidate, offer, session);
                remindedPairs.add(key);
            }
        }
    } catch (error) {
        console.log('[scheduler] reminders error:', error.message);
    }
}

/**
 * Every 5 minutes, mark IN_PROGRESS attempts whose expiresAt has passed as EXPIRED
 * (without auto-grading — the candidate left mid-way; HR can still review what was saved).
 * Note: If the candidate hits the runner endpoint, autoExpireIfNeeded will finalize+grade.
 * This sweep handles the abandoned case so HR sees a stable status.
 */
async function expireStaleAttempts() {
    try {
        const now = new Date();
        const stale = await attemptModel.find({
            status: ATTEMPT_STATUSES.IN_PROGRESS,
            expiresAt: { $lt: now },
        });

        for (const attempt of stale) {
            // Run finalize so they get an auto-graded score for what they did answer.
            const { finalizeAttempt } = require('../controllers/attempt.controller');
            await finalizeAttempt(attempt, { autoSubmitted: true });
        }
        if (stale.length) {
            console.log(`[scheduler] finalized ${stale.length} expired attempts`);
        }
    } catch (error) {
        console.log('[scheduler] expire error:', error.message);
    }
}

function startScheduler() {
    // Reminders: every 10 minutes
    cron.schedule('*/10 * * * *', sendUpcomingSessionReminders);
    // Expire stale: every 5 minutes
    cron.schedule('*/5 * * * *', expireStaleAttempts);
    console.log('[scheduler] started');
}

module.exports = { startScheduler };
