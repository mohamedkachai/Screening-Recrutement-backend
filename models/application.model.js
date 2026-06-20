const mongoose = require('mongoose');
const { APPLICATION_STATUS_VALUES, APPLICATION_STATUSES } = require('./enums');

const applicationSchema = new mongoose.Schema(
    {
        offerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'offers',
            required: true,
        },
        candidateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            required: true,
        },
        status: {
            type: String,
            enum: APPLICATION_STATUS_VALUES,
            default: APPLICATION_STATUSES.APPLIED,
        },
        appliedAt: {
            type: Date,
            default: Date.now,
        },
        coverNote: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

applicationSchema.index({ offerId: 1, candidateId: 1 }, { unique: true });
applicationSchema.index({ candidateId: 1, createdAt: -1 });

const applicationModel = mongoose.model('applications', applicationSchema);

module.exports = applicationModel;
