const mongoose = require('mongoose');
const crypto = require('crypto');

const invitationSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        offerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'offers',
            default: null,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        acceptedAt: {
            type: Date,
            default: null,
        },
        acceptedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            default: null,
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            required: true,
        },
        message: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

/**
 * Creates a fresh raw token + hashed copy + expiry (default 7 days).
 */
invitationSchema.statics.generateToken = function (ttlMs = 7 * 24 * 60 * 60 * 1000) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMs);
    return { rawToken, tokenHash, expiresAt };
};

invitationSchema.statics.hashToken = function (rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
};

const invitationModel = mongoose.model('invitations', invitationSchema);

module.exports = invitationModel;
