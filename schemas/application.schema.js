const { z } = require('zod');
const { APPLICATION_STATUS_VALUES } = require('../models/enums');

const applySchema = z.object({
    coverNote: z.string().max(2000).optional(),
});

const updateApplicationStatusSchema = z.object({
    status: z.enum(APPLICATION_STATUS_VALUES),
});

module.exports = { applySchema, updateApplicationStatusSchema };
