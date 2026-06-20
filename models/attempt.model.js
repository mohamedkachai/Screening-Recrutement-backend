const mongoose = require('mongoose');
const { ATTEMPT_STATUS_VALUES, ATTEMPT_STATUSES } = require('./enums');

const answerSchema = new mongoose.Schema(
    {
        testId: { type: mongoose.Schema.Types.ObjectId, ref: 'tests', required: true },
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'questions', required: true },
        // mixed: string for short/essay/code, array of option ids for MCQ, single id for SINGLE/TF
        value: { type: mongoose.Schema.Types.Mixed },
        autoPoints: { type: Number, default: 0 },
        manualPoints: { type: Number, default: null }, // null = not yet manually graded
        manualFeedback: { type: String, default: '' },
        graded: { type: Boolean, default: false }, // true once auto-graded OR fully manually graded
        needsManualGrading: { type: Boolean, default: false },
    },
    { _id: false }
);

const eventSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['TAB_SWITCH', 'FULLSCREEN_EXIT', 'COPY_PASTE_BLOCKED', 'AUTO_SUBMITTED'],
            required: true,
        },
        at: { type: Date, default: Date.now },
        meta: { type: mongoose.Schema.Types.Mixed },
    },
    { _id: false }
);

const attemptSchema = new mongoose.Schema(
    {
        offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'offers', required: true },
        sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'sessions', required: true },
        applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'applications' },
        candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },

        status: {
            type: String,
            enum: ATTEMPT_STATUS_VALUES,
            default: ATTEMPT_STATUSES.NOT_STARTED,
        },

        // ordered question/test plan, captured when attempt starts (so randomization is stable)
        plan: [
            {
                testId: { type: mongoose.Schema.Types.ObjectId, ref: 'tests' },
                questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'questions' }],
            },
        ],

        startedAt: { type: Date },
        submittedAt: { type: Date },
        expiresAt: { type: Date },

        answers: [answerSchema],

        // scoring
        autoScore: { type: Number, default: 0 },
        manualScore: { type: Number, default: 0 },
        totalScore: { type: Number, default: 0 },
        maxScore: { type: Number, default: 0 },

        // anti-cheat
        events: [eventSchema],
        tabSwitchCount: { type: Number, default: 0 },
        fullscreenExitCount: { type: Number, default: 0 },
        autoSubmitted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

attemptSchema.index({ offerId: 1, candidateId: 1 }, { unique: true });

module.exports = mongoose.model('attempts', attemptSchema);
