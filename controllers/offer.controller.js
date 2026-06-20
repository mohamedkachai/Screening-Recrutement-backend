const offerModel = require('../models/offer.model');
const applicationModel = require('../models/application.model');
const { createOfferSchema, updateOfferSchema } = require('../schemas/offer.schema');
const { saveLog } = require('../utils/logger');
const { OFFER_STATUSES, ROLES } = require('../models/enums');

function isManager(user) {
    return user && (user.role === ROLES.ADMIN || user.role === ROLES.HR);
}

async function createOffer(req, res) {
    try {
        const validation = createOfferSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const offer = await offerModel.create({
            ...req.body,
            createdBy: req.user._id,
        });

        await saveLog({
            action: `${req.user.firstName} created offer "${offer.title}"`,
            actorId: req.user._id,
        });

        return res.status(201).json({
            status: true,
            offer,
            message: 'Offer created successfully',
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function listOffers(req, res) {
    try {
        const { status, type } = req.query;
        const filter = {};

        if (status) {
            filter.status = status;
        }
        if (type) {
            filter.type = type;
        }

        const offers = await offerModel
            .find(filter)
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: -1 });

        return res.status(200).json({ status: true, offers });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function listPublicOffers(req, res) {
    try {
        const userId = req.user?._id;
        const filter = {
            status: OFFER_STATUSES.OPEN,
            $or: [
                { isHidden: { $ne: true } },
                ...(userId ? [{ allowedCandidates: userId }] : []),
            ],
        };

        const offers = await offerModel
            .find(filter)
            .select('-createdBy')
            .sort({ createdAt: -1 });

        return res.status(200).json({ status: true, offers });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function getOffer(req, res) {
    try {
        const offer = await offerModel
            .findById(req.params.id)
            .populate('createdBy', 'firstName lastName email');

        if (!offer) {
            return res.status(404).json({ status: false, message: 'Offer not found' });
        }

        // Candidates can only fetch OPEN offers
        if (!isManager(req.user) && offer.status !== OFFER_STATUSES.OPEN) {
            return res.status(404).json({ status: false, message: 'Offer not found' });
        }

        let alreadyApplied = false;
        if (req.user) {
            alreadyApplied = Boolean(
                await applicationModel.exists({
                    offerId: offer._id,
                    candidateId: req.user._id,
                })
            );
        }

        return res.status(200).json({ status: true, offer, alreadyApplied });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function updateOffer(req, res) {
    try {
        const validation = updateOfferSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const offer = await offerModel.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!offer) {
            return res.status(404).json({ status: false, message: 'Offer not found' });
        }

        await saveLog({
            action: `${req.user.firstName} updated offer "${offer.title}"`,
            actorId: req.user._id,
        });

        return res.status(200).json({
            status: true,
            offer,
            message: 'Offer updated successfully',
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function deleteOffer(req, res) {
    try {
        const offer = await offerModel.findById(req.params.id);

        if (!offer) {
            return res.status(404).json({ status: false, message: 'Offer not found' });
        }

        await offerModel.findByIdAndDelete(req.params.id);

        await saveLog({
            action: `${req.user.firstName} deleted offer "${offer.title}"`,
            actorId: req.user._id,
        });

        return res.status(204).json();
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

module.exports = {
    createOffer,
    listOffers,
    listPublicOffers,
    getOffer,
    updateOffer,
    deleteOffer,
};
