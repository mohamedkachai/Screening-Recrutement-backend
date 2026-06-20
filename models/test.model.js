const mongoose = require('mongoose');

const testSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        durationMinutes: {
            type: Number,
            required: [true, 'Duration is required'],
            min: 1,
        },
        passingScore: {
            type: Number,
            min: 0,
            default: 0,
        },
        totalPoints: {
            type: Number,
            default: 0,
        },
        questionCount: {
            type: Number,
            default: 0,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            required: true,
        },
    },
    { timestamps: true }
);

const testModel = mongoose.model('tests', testSchema);

module.exports = testModel;
