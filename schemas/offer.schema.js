const { z } = require('zod');
const {
    OFFER_TYPE_VALUES,
    OFFER_STATUS_VALUES,
    WORK_MODE_VALUES,
} = require('../models/enums');

const baseOfferShape = {
    title: z.string().min(1, { message: 'Title is required' }),
    description: z.string().min(1, { message: 'Description is required' }),
    location: z.string().optional().nullable(),
    workMode: z.enum(WORK_MODE_VALUES).optional().nullable(),
    type: z.enum(OFFER_TYPE_VALUES),
    requiredSkills: z.array(z.string()).optional(),
    salaryMin: z.number().min(0).optional().nullable(),
    salaryMax: z.number().min(0).optional().nullable(),
    currency: z.string().min(1).optional(),
    deadline: z.string().optional().nullable(),
    status: z.enum(OFFER_STATUS_VALUES).optional(),
    isHidden: z.boolean().optional(),
    allowedCandidates: z.array(z.string()).optional(),
    autoRejectThreshold: z.number().min(0).max(100).optional(),
};

const createOfferSchema = z
    .object(baseOfferShape)
    .refine(
        (data) =>
            data.salaryMin == null ||
            data.salaryMax == null ||
            data.salaryMin <= data.salaryMax,
        { message: 'salaryMin must be ≤ salaryMax', path: ['salaryMax'] }
    );

const updateOfferSchema = createOfferSchema;

module.exports = { createOfferSchema, updateOfferSchema };
