const offerModel = require('../models/offer.model');
const applicationModel = require('../models/application.model');
const userModel = require('../models/user.model');
const { applySchema, updateApplicationStatusSchema } = require('../schemas/application.schema');
const { saveLog } = require('../utils/logger');
const {
    notifyApplicationReceived,
    notifyHrNewApplication,
    notifyApplicationStatusChange,
} = require('../utils/notifications');
const { OFFER_STATUSES, ROLES } = require('../models/enums');

async function applyToOffer(req, res) {
    try {
        const validation = applySchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const offer = await offerModel.findById(req.params.id);

        if (!offer || offer.status !== OFFER_STATUSES.OPEN) {
            return res.status(404).json({ status: false, message: 'Offer not found or closed' });
        }

        const existing = await applicationModel.findOne({
            offerId: offer._id,
            candidateId: req.user._id,
        });

        if (existing) {
            return res.status(409).json({
                status: false,
                message: 'You have already applied to this offer',
            });
        }

        const application = await applicationModel.create({
            offerId: offer._id,
            candidateId: req.user._id,
            coverNote: req.body.coverNote,
        });

        await saveLog({
            action: `${req.user.firstName} applied to offer "${offer.title}"`,
            actorId: req.user._id,
        });

        // Email candidate confirmation + notify HR who created the offer
        await notifyApplicationReceived(req.user, offer);
        const recruiter = await userModel.findById(offer.createdBy);
        await notifyHrNewApplication(recruiter, req.user, offer);

        return res.status(201).json({
            status: true,
            application,
            message: 'Application submitted successfully',
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function listOfferApplications(req, res) {
    try {
        const applications = await applicationModel
            .find({ offerId: req.params.id })
            .populate('candidateId', 'firstName lastName email avatar phone country yearsOfExperience skills cv')
            .sort({ createdAt: -1 });

        return res.status(200).json({ status: true, applications });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function listMyApplications(req, res) {
    try {
        const applications = await applicationModel
            .find({ candidateId: req.user._id })
            .populate('offerId', 'title type status location workMode deadline')
            .sort({ createdAt: -1 });

        return res.status(200).json({ status: true, applications });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function updateApplicationStatus(req, res) {
    try {
        const validation = updateApplicationStatusSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const application = await applicationModel
            .findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true })
            .populate('candidateId', 'firstName email')
            .populate('offerId', 'title');

        if (!application) {
            return res.status(404).json({ status: false, message: 'Application not found' });
        }

        await saveLog({
            action: `${req.user.firstName} changed application status to ${req.body.status} for ${application.candidateId.firstName} on "${application.offerId.title}"`,
            actorId: req.user._id,
        });

        await notifyApplicationStatusChange(
            application.candidateId,
            application.offerId,
            req.body.status
        );

        return res.status(200).json({
            status: true,
            application,
            message: 'Application status updated',
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

module.exports = {
    applyToOffer,
    listOfferApplications,
    listMyApplications,
    updateApplicationStatus,
    ROLES,
};
