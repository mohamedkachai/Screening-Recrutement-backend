const sessionModel = require('../models/session.model');
const offerModel = require('../models/offer.model');
const {
    upsertSessionSchema,
    updateSessionSchema,
} = require('../schemas/session.schema');
const { saveLog } = require('../utils/logger');

/**
 * Returns SCHEDULED / ACTIVE / CLOSED based on now vs window.
 */
function deriveStatus(session, now = new Date()) {
    if (!session) {
        return null;
    }
    if (now < session.startAt) {
        return 'SCHEDULED';
    }
    if (now > session.endAt) {
        return 'CLOSED';
    }
    return 'ACTIVE';
}

async function getSessionByOffer(req, res) {
    try {
        const { offerId } = req.params;

        const offer = await offerModel.findById(offerId)
            .select('_id title status testIds')
            .populate('testIds', 'title durationMinutes questionCount totalPoints');
        if (!offer) {
            return res.status(404).json({ status: false, message: 'Offer not found' });
        }

        const session = await sessionModel.findOne({ offerId });
        const tests = offer.testIds;

        return res.status(200).json({
            status: true,
            offer,
            session,
            sessionStatus: session ? deriveStatus(session) : null,
            tests,
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function upsertSession(req, res) {
    try {
        const validation = upsertSessionSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const offer = await offerModel.findById(req.params.offerId);
        if (!offer) {
            return res.status(404).json({ status: false, message: 'Offer not found' });
        }

        const existing = await sessionModel.findOne({ offerId: offer._id });

        let session;
        if (existing) {
            Object.assign(existing, validation.data);
            session = await existing.save();
        } else {
            session = await sessionModel.create({
                ...validation.data,
                offerId: offer._id,
                createdBy: req.user._id,
            });
        }

        await saveLog({
            action: `${req.user.firstName} ${existing ? 'updated' : 'created'} session for offer "${offer.title}"`,
            actorId: req.user._id,
        });

        return res.status(existing ? 200 : 201).json({
            status: true,
            session,
            sessionStatus: deriveStatus(session),
            message: existing ? 'Session updated' : 'Session scheduled',
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function updateSession(req, res) {
    try {
        const validation = updateSessionSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const session = await sessionModel.findByIdAndUpdate(
            req.params.sessionId,
            validation.data,
            { new: true, runValidators: true }
        );

        if (!session) {
            return res.status(404).json({ status: false, message: 'Session not found' });
        }

        await saveLog({
            action: `${req.user.firstName} updated session ${session._id}`,
            actorId: req.user._id,
        });

        return res.status(200).json({
            status: true,
            session,
            sessionStatus: deriveStatus(session),
            message: 'Session updated',
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function deleteSession(req, res) {
    try {
        const session = await sessionModel.findByIdAndDelete(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ status: false, message: 'Session not found' });
        }

        await saveLog({
            action: `${req.user.firstName} deleted session ${session._id}`,
            actorId: req.user._id,
        });

        return res.status(204).json();
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

module.exports = {
    getSessionByOffer,
    upsertSession,
    updateSession,
    deleteSession,
    deriveStatus,
};
