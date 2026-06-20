const { z } = require('zod');
const { QUESTION_TYPE_VALUES, QUESTION_TYPES } = require('../models/enums');

const createTestSchema = z.object({
    title: z.string().min(1, { message: 'Title is required' }),
    description: z.string().optional().nullable(),
    durationMinutes: z.number().int().min(1, { message: 'Duration must be at least 1 minute' }),
    passingScore: z.number().min(0).optional(),
});

const updateTestSchema = createTestSchema.partial().extend({
    title: z.string().min(1).optional(),
    durationMinutes: z.number().int().min(1).optional(),
});

const reorderTestsSchema = z.object({
    orderedIds: z.array(z.string()).min(1),
});

const optionInputSchema = z.object({
    text: z.string().min(1),
    isCorrect: z.boolean().optional(),
});

const baseQuestionShape = {
    type: z.enum(QUESTION_TYPE_VALUES),
    prompt: z.string().min(1),
    points: z.number().min(0).default(1),
    options: z.array(optionInputSchema).optional(),
    expectedAnswer: z.string().optional().nullable(),
    caseSensitive: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
};

const validateQuestionShape = (data, ctx) => {
    if (data.type === QUESTION_TYPES.MCQ_SINGLE) {
        if (!data.options || data.options.length < 2) {
            ctx.addIssue({ code: 'custom', message: 'MCQ_SINGLE needs at least 2 options', path: ['options'] });
        } else if (data.options.filter((o) => o.isCorrect).length !== 1) {
            ctx.addIssue({ code: 'custom', message: 'MCQ_SINGLE needs exactly one correct option', path: ['options'] });
        }
    }
    if (data.type === QUESTION_TYPES.MCQ_MULTI) {
        if (!data.options || data.options.length < 2) {
            ctx.addIssue({ code: 'custom', message: 'MCQ_MULTI needs at least 2 options', path: ['options'] });
        } else if (!data.options.some((o) => o.isCorrect)) {
            ctx.addIssue({ code: 'custom', message: 'MCQ_MULTI needs at least one correct option', path: ['options'] });
        }
    }
    if (data.type === QUESTION_TYPES.TRUE_FALSE) {
        const opts = data.options || [];
        if (opts.length !== 2 || opts.filter((o) => o.isCorrect).length !== 1) {
            ctx.addIssue({
                code: 'custom',
                message: 'TRUE_FALSE needs exactly 2 options with one correct',
                path: ['options'],
            });
        }
    }
    if (data.type === QUESTION_TYPES.SHORT_TEXT) {
        if (!data.expectedAnswer || data.expectedAnswer.trim().length === 0) {
            ctx.addIssue({
                code: 'custom',
                message: 'SHORT_TEXT requires an expected answer',
                path: ['expectedAnswer'],
            });
        }
    }
};

const createQuestionSchema = z.object(baseQuestionShape).superRefine(validateQuestionShape);
const updateQuestionSchema = z.object(baseQuestionShape).superRefine(validateQuestionShape);

const reorderQuestionsSchema = z.object({
    orderedIds: z.array(z.string()).min(1),
});

module.exports = {
    createTestSchema,
    updateTestSchema,
    reorderTestsSchema,
    createQuestionSchema,
    updateQuestionSchema,
    reorderQuestionsSchema,
};
