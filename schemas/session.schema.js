const { z } = require('zod');

const baseFields = {
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    instructions: z.string().max(5000).optional(),
    randomizeQuestions: z.boolean().optional(),
    tabSwitchLimit: z.number().int().min(0).optional(),
    preventCopyPaste: z.boolean().optional(),
    requireFullscreen: z.boolean().optional(),
    allowedAttempts: z.number().int().min(1).optional(),
};

const validateWindow = (data, ctx) => {
    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
        ctx.addIssue({
            code: 'custom',
            path: ['endAt'],
            message: 'endAt must be after startAt',
        });
    }
};

const upsertSessionSchema = z.object(baseFields).superRefine(validateWindow);

const updateSessionSchema = z
    .object({
        startAt: baseFields.startAt.optional(),
        endAt: baseFields.endAt.optional(),
        instructions: baseFields.instructions,
        randomizeQuestions: baseFields.randomizeQuestions,
        tabSwitchLimit: baseFields.tabSwitchLimit,
        preventCopyPaste: baseFields.preventCopyPaste,
        requireFullscreen: baseFields.requireFullscreen,
        allowedAttempts: baseFields.allowedAttempts,
    })
    .superRefine(validateWindow);

module.exports = {
    upsertSessionSchema,
    updateSessionSchema,
};
