const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
    {
        offerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'offers',
            required: true,
            unique: true,
        },
        startAt: { type: Date, required: true },
        endAt: { type: Date, required: true },
        instructions: { type: String, default: '' },
        randomizeQuestions: { type: Boolean, default: true },
        tabSwitchLimit: { type: Number, default: 3, min: 0 },
        // anti-cheat toggles
        preventCopyPaste: { type: Boolean, default: true },
        requireFullscreen: { type: Boolean, default: true },
        // attempts policy (single-attempt enforced by default)
        allowedAttempts: { type: Number, default: 1, min: 1 },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('sessions', sessionSchema);
