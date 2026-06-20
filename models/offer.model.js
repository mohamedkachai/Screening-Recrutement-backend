const mongoose = require('mongoose');
const {
    OFFER_TYPE_VALUES,
    OFFER_STATUS_VALUES,
    OFFER_STATUSES,
    WORK_MODE_VALUES,
} = require('./enums');

const offerSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
        },
        location: {
            type: String,
            trim: true,
        },
        workMode: {
            type: String,
            enum: WORK_MODE_VALUES,
        },
        type: {
            type: String,
            enum: OFFER_TYPE_VALUES,
            required: [true, 'Offer type is required'],
        },
        requiredSkills: {
            type: [String],
            default: [],
        },
        salaryMin: {
            type: Number,
            min: 0,
        },
        salaryMax: {
            type: Number,
            min: 0,
        },
        currency: {
            type: String,
            default: 'USD',
            trim: true,
        },
        deadline: {
            type: Date,
        },
        status: {
            type: String,
            enum: OFFER_STATUS_VALUES,
            default: OFFER_STATUSES.DRAFT,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            required: true,
        },
        testIds: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'tests' }],
            default: [],
        },
        isHidden: { type: Boolean, default: false },
        allowedCandidates: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'users' }],
            default: [],
        },
        autoRejectThreshold: { type: Number, min: 0, max: 100, default: 0 },
    },
    { timestamps: true }
);

offerSchema.index({ status: 1, createdAt: -1 });

const offerModel = mongoose.model('offers', offerSchema);

module.exports = offerModel;
