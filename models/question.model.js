const mongoose = require('mongoose');
const { QUESTION_TYPE_VALUES } = require('./enums');

const optionSchema = new mongoose.Schema(
    {
        text: { type: String, required: true, trim: true },
        isCorrect: { type: Boolean, default: false },
    },
    { _id: true }
);

const questionSchema = new mongoose.Schema(
    {
        testId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'tests',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: QUESTION_TYPE_VALUES,
            required: true,
        },
        prompt: {
            type: String,
            required: [true, 'Prompt is required'],
            trim: true,
        },
        points: {
            type: Number,
            required: true,
            min: 0,
            default: 1,
        },
        // For MCQ_*  / TRUE_FALSE
        options: {
            type: [optionSchema],
            default: [],
        },
        // For SHORT_TEXT auto-grading
        expectedAnswer: {
            type: String,
            trim: true,
        },
        caseSensitive: {
            type: Boolean,
            default: false,
        },
        order: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

questionSchema.index({ testId: 1, order: 1 });

const questionModel = mongoose.model('questions', questionSchema);

module.exports = questionModel;
