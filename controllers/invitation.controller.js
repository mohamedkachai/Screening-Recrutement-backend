const invitationModel = require('../models/invitation.model');
const userModel = require('../models/user.model');
const offerModel = require('../models/offer.model');
const applicationModel = require('../models/application.model');
const sendEmail = require('../utils/mailer');
const { saveLog } = require('../utils/logger');
const { generateToken } = require('../utils/jwt');
const {
    createInvitationSchema,
    acceptInvitationSchema,
} = require('../schemas/invitation.schema');
const { ROLES, OFFER_STATUSES, APPLICATION_STATUSES } = require('../models/enums');

async function createInvitation(req, res) {
    try {
        const validation = createInvitationSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const { email, offerId, message, ttlDays } = req.body;

        // Reject if active user already exists with that email AND no offer (just inviting to platform)
        const existingUser = await userModel.findOne({ email });
        if (existingUser && !offerId) {
            return res.status(409).json({
                status: false,
                message: 'A user already exists with this email',
            });
        }

        let offer = null;
        if (offerId) {
            offer = await offerModel.findById(offerId);
            if (!offer) {
                return res.status(404).json({ status: false, message: 'Offer not found' });
            }
        }

        const ttlMs = (ttlDays ?? 7) * 24 * 60 * 60 * 1000;
        const { rawToken, tokenHash, expiresAt } = invitationModel.generateToken(ttlMs);

        const invitation = await invitationModel.create({
            email,
            offerId: offerId || null,
            tokenHash,
            expiresAt,
            invitedBy: req.user._id,
            message,
        });

        const inviteUrl = `${process.env.FRONTEND_URL}/invitations/${rawToken}`;

        const subject = offer ? `You're invited: ${offer.title}` : 'You have been invited';
        const content = [
            `Hi,`,
            ``,
            `${req.user.firstName} ${req.user.lastName} has invited you${offer ? ` to apply for "${offer.title}"` : ' to join the platform'}.`,
            message ? `\nMessage from ${req.user.firstName}:\n${message}\n` : '',
            `Accept the invitation here: ${inviteUrl}`,
            ``,
            `This link expires on ${expiresAt.toUTCString()}.`,
        ].join('\n');

        try {
            await sendEmail({ email, subject, content });
        } catch (mailError) {
            console.log('Invitation email failed:', mailError.message);
        }

        await saveLog({
            action: `${req.user.firstName} invited ${email}${offer ? ` to "${offer.title}"` : ''}`,
            actorId: req.user._id,
        });

        return res.status(201).json({
            status: true,
            invitation: {
                _id: invitation._id,
                email: invitation.email,
                offerId: invitation.offerId,
                expiresAt: invitation.expiresAt,
                createdAt: invitation.createdAt,
            },
            message: 'Invitation sent',
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function listInvitations(req, res) {
    try {
        const filter = {};
        if (req.query.offerId) {
            filter.offerId = req.query.offerId;
        }

        const invitations = await invitationModel
            .find(filter)
            .populate('offerId', 'title status')
            .populate('invitedBy', 'firstName lastName email')
            .populate('acceptedBy', 'firstName lastName email')
            .sort({ createdAt: -1 });

        return res.status(200).json({ status: true, invitations });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function revokeInvitation(req, res) {
    try {
        const invitation = await invitationModel.findById(req.params.id);

        if (!invitation) {
            return res.status(404).json({ status: false, message: 'Invitation not found' });
        }

        if (invitation.acceptedAt) {
            return res.status(400).json({
                status: false,
                message: 'Invitation has already been accepted',
            });
        }

        await invitationModel.findByIdAndDelete(req.params.id);

        await saveLog({
            action: `${req.user.firstName} revoked invitation for ${invitation.email}`,
            actorId: req.user._id,
        });

        return res.status(204).json();
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

// Public: candidate fetches invitation details by raw token to render accept form
async function getInvitationByToken(req, res) {
    try {
        const tokenHash = invitationModel.hashToken(req.params.token);

        const invitation = await invitationModel
            .findOne({ tokenHash })
            .populate('offerId', 'title type location status')
            .populate('invitedBy', 'firstName lastName');

        if (!invitation) {
            return res.status(404).json({ status: false, message: 'Invitation not found' });
        }

        if (invitation.acceptedAt) {
            return res.status(410).json({
                status: false,
                message: 'Invitation has already been accepted',
            });
        }

        if (invitation.expiresAt < new Date()) {
            return res.status(410).json({ status: false, message: 'Invitation has expired' });
        }

        return res.status(200).json({
            status: true,
            invitation: {
                email: invitation.email,
                offer: invitation.offerId,
                invitedBy: invitation.invitedBy,
                message: invitation.message,
                expiresAt: invitation.expiresAt,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

// Public: candidate accepts invitation, account is created, optionally auto-applied to offer
async function acceptInvitation(req, res) {
    try {
        const validation = acceptInvitationSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const tokenHash = invitationModel.hashToken(req.params.token);

        const invitation = await invitationModel.findOne({ tokenHash });

        if (!invitation) {
            return res.status(404).json({ status: false, message: 'Invitation not found' });
        }

        if (invitation.acceptedAt) {
            return res.status(410).json({
                status: false,
                message: 'Invitation has already been accepted',
            });
        }

        if (invitation.expiresAt < new Date()) {
            return res.status(410).json({ status: false, message: 'Invitation has expired' });
        }

        const existingUser = await userModel.findOne({ email: invitation.email });
        if (existingUser) {
            return res.status(409).json({
                status: false,
                message: 'An account with this email already exists. Please log in instead.',
            });
        }

        const { firstName, lastName, password, confirmPassword, dob } = req.body;

        const user = new userModel({
            email: invitation.email,
            firstName,
            lastName,
            password,
            confirmPassword,
            dob,
            role: ROLES.CANDIDATE,
        });
        await user.save();

        invitation.acceptedAt = new Date();
        invitation.acceptedBy = user._id;
        await invitation.save();

        // Auto-apply to offer if invitation was tied to one and offer is OPEN
        let application = null;
        if (invitation.offerId) {
            const offer = await offerModel.findById(invitation.offerId);
            if (offer && offer.status === OFFER_STATUSES.OPEN) {
                application = await applicationModel.create({
                    offerId: offer._id,
                    candidateId: user._id,
                    status: APPLICATION_STATUSES.INVITED,
                });
            }
        }

        await saveLog({
            action: `${firstName} accepted invitation${invitation.offerId ? ' (offer auto-application created)' : ''}`,
            actorId: user._id,
        });

        const token = generateToken(user._id);

        return res.status(201).json({
            status: true,
            token,
            user: { _id: user._id, email: user.email, firstName, lastName, role: user.role },
            applicationId: application?._id || null,
            message: 'Welcome aboard',
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function createBatchInvitations(req, res) {
    try {
        const { emails, offerId, message, ttlDays } = req.body;

        if (!Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ status: false, message: 'emails must be a non-empty array' });
        }

        if (emails.length > 100) {
            return res.status(400).json({ status: false, message: 'Maximum 100 emails per batch' });
        }

        let offer = null;
        if (offerId) {
            offer = await offerModel.findById(offerId);
            if (!offer) {
                return res.status(404).json({ status: false, message: 'Offer not found' });
            }
        }

        const ttlMs = (ttlDays ?? 7) * 24 * 60 * 60 * 1000;
        const subject = offer ? `You're invited: ${offer.title}` : 'You have been invited';

        const results = await Promise.allSettled(
            emails.map(async (email) => {
                const { rawToken, tokenHash, expiresAt } = invitationModel.generateToken(ttlMs);

                const invitation = await invitationModel.create({
                    email,
                    offerId: offerId || null,
                    tokenHash,
                    expiresAt,
                    invitedBy: req.user._id,
                    message,
                });

                const inviteUrl = `${process.env.FRONTEND_URL}/invitations/${rawToken}`;

                const content = [
                    `Hi,`,
                    ``,
                    `${req.user.firstName} ${req.user.lastName} has invited you${offer ? ` to apply for "${offer.title}"` : ' to join the platform'}.`,
                    message ? `\nMessage from ${req.user.firstName}:\n${message}\n` : '',
                    `Accept the invitation here: ${inviteUrl}`,
                    ``,
                    `This link expires on ${expiresAt.toUTCString()}.`,
                ].join('\n');

                await sendEmail({ email, subject, content });

                return { email, invitationId: invitation._id };
            }),
        );

        const sent = [];
        const failed = [];

        for (const [i, result] of results.entries()) {
            if (result.status === 'fulfilled') {
                sent.push(result.value);
            } else {
                failed.push({ email: emails[i], reason: result.reason?.message ?? 'Unknown error' });
            }
        }

        await saveLog({
            action: `${req.user.firstName} sent batch invitations (${sent.length} sent, ${failed.length} failed)${offer ? ` for "${offer.title}"` : ''}`,
            actorId: req.user._id,
        });

        return res.status(207).json({ status: true, sent, failed });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

module.exports = {
    createInvitation,
    createBatchInvitations,
    listInvitations,
    revokeInvitation,
    getInvitationByToken,
    acceptInvitation,
};
