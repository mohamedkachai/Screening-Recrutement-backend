const testModel = require('../models/test.model');
const questionModel = require('../models/question.model');
const offerModel = require('../models/offer.model');
const {
    createTestSchema,
    updateTestSchema,
    reorderTestsSchema,
} = require('../schemas/test.schema');
const { saveLog } = require('../utils/logger');
const { generateQuestions } = require('../utils/ai');
const { QUESTION_TYPES } = require('../models/enums');

/**
 * Recompute and persist totalPoints + questionCount on a test.
 */
async function recomputeTestTotals(testId) {
    const questions = await questionModel.find({ testId }).select('points');
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
    await testModel.findByIdAndUpdate(testId, {
        totalPoints,
        questionCount: questions.length,
    });
    return { totalPoints, questionCount: questions.length };
}

async function listTests(req, res) {
    try {
        const { offerId } = req.params;

        const offer = await offerModel.findById(offerId).select('_id title testIds').populate('testIds');
        if (!offer) {
            return res.status(404).json({ status: false, message: 'Offer not found' });
        }

        return res.status(200).json({ status: true, offer: { _id: offer._id, title: offer.title }, tests: offer.testIds });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

/**
 * GET /test
 * Return all tests in the library with how many offers each is assigned to.
 */
async function listAllTests(req, res) {
    try {
        const tests = await testModel.find().sort({ createdAt: -1 });

        const testIds = tests.map((t) => t._id);
        const offerCounts = await offerModel.aggregate([
            { $match: { testIds: { $in: testIds } } },
            { $unwind: '$testIds' },
            { $match: { testIds: { $in: testIds } } },
            { $group: { _id: '$testIds', count: { $sum: 1 } } },
        ]);
        const countMap = new Map(offerCounts.map((r) => [String(r._id), r.count]));

        const result = tests.map((t) => ({
            ...t.toObject(),
            assignedToCount: countMap.get(String(t._id)) || 0,
        }));

        return res.status(200).json({ status: true, tests: result });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

/**
 * POST /test
 * Create a standalone test (not assigned to any offer yet).
 */
async function createTest(req, res) {
    try {
        const validation = createTestSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const test = await testModel.create({
            ...validation.data,
            createdBy: req.user._id,
        });

        await saveLog({
            action: `${req.user.firstName} created test "${test.title}"`,
            actorId: req.user._id,
        });

        return res.status(201).json({ status: true, test, message: 'Test created' });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function getTest(req, res) {
    try {
        const test = await testModel.findById(req.params.testId);

        if (!test) {
            return res.status(404).json({ status: false, message: 'Test not found' });
        }

        const assignedOffers = await offerModel.find({ testIds: test._id }).select('_id title status');
        const questions = await questionModel.find({ testId: test._id }).sort({ order: 1, createdAt: 1 });

        return res.status(200).json({ status: true, test, questions, assignedOffers });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function updateTest(req, res) {
    try {
        const validation = updateTestSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const test = await testModel.findByIdAndUpdate(req.params.testId, validation.data, {
            new: true,
            runValidators: true,
        });

        if (!test) {
            return res.status(404).json({ status: false, message: 'Test not found' });
        }

        await saveLog({
            action: `${req.user.firstName} updated test "${test.title}"`,
            actorId: req.user._id,
        });

        return res.status(200).json({ status: true, test, message: 'Test updated' });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function deleteTest(req, res) {
    try {
        const test = await testModel.findById(req.params.testId);

        if (!test) {
            return res.status(404).json({ status: false, message: 'Test not found' });
        }

        await questionModel.deleteMany({ testId: test._id });
        await offerModel.updateMany({ testIds: test._id }, { $pull: { testIds: test._id } });
        await testModel.findByIdAndDelete(test._id);

        await saveLog({
            action: `${req.user.firstName} deleted test "${test.title}"`,
            actorId: req.user._id,
        });

        return res.status(204).send();
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

/**
 * POST /test/:testId/assign  — body: { offerId }
 */
async function assignTest(req, res) {
    try {
        const { testId } = req.params;
        const { offerId } = req.body;

        const [test, offer] = await Promise.all([
            testModel.findById(testId),
            offerModel.findById(offerId),
        ]);

        if (!test) return res.status(404).json({ status: false, message: 'Test not found' });
        if (!offer) return res.status(404).json({ status: false, message: 'Offer not found' });

        if (offer.testIds.some((id) => String(id) === String(testId))) {
            return res.status(409).json({ status: false, message: 'Test already assigned to this offer' });
        }

        offer.testIds.push(test._id);
        await offer.save();

        await saveLog({
            action: `${req.user.firstName} assigned test "${test.title}" to offer "${offer.title}"`,
            actorId: req.user._id,
        });

        return res.status(200).json({ status: true, message: 'Test assigned to offer' });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

/**
 * DELETE /test/:testId/assign/:offerId  — remove from offer
 */
async function unassignTest(req, res) {
    try {
        const { testId, offerId } = req.params;

        const offer = await offerModel.findById(offerId);
        if (!offer) return res.status(404).json({ status: false, message: 'Offer not found' });

        offer.testIds = offer.testIds.filter((id) => String(id) !== String(testId));
        await offer.save();

        await saveLog({
            action: `${req.user.firstName} unassigned test ${testId} from offer "${offer.title}"`,
            actorId: req.user._id,
        });

        return res.status(200).json({ status: true, message: 'Test removed from offer' });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

/**
 * PUT /test/offer/:offerId/reorder  — body: { orderedIds: [...] }
 */
async function reorderOfferTests(req, res) {
    try {
        const validation = reorderTestsSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const offer = await offerModel.findById(req.params.offerId);
        if (!offer) return res.status(404).json({ status: false, message: 'Offer not found' });

        const assignedSet = new Set(offer.testIds.map(String));
        offer.testIds = req.body.orderedIds.filter((id) => assignedSet.has(id));
        await offer.save();

        return res.status(200).json({ status: true, message: 'Tests reordered' });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function generateAiQuestions(req, res) {
    try {
        const { testId } = req.params;
        const test = await testModel.findById(testId);
        if (!test) return res.status(404).json({ status: false, message: 'Test not found' });

        const { topic, count = 5, types = ['MCQ_SINGLE'], difficulty = 'medium' } = req.body;
        if (!topic) return res.status(400).json({ status: false, message: 'topic is required' });

        const typeAlias = {
            SHORT_ANSWER: QUESTION_TYPES.SHORT_TEXT,
            LONG_ANSWER: QUESTION_TYPES.ESSAY,
        };
        const normalizedTypes = Array.isArray(types)
            ? types.map((type) => typeAlias[type] || type)
            : ['MCQ_SINGLE'];

        const rawQuestions = await generateQuestions({ topic, count: Math.min(count, 20), types: normalizedTypes, difficulty });

        // Get current max order for this test
        const lastQ = await questionModel.findOne({ testId }).sort({ order: -1 }).select('order');
        let order = (lastQ?.order ?? -1) + 1;

        const docs = rawQuestions.map((q) => ({
            testId,
            type: q.type,
            prompt: q.text ?? q.prompt,
            points: q.points ?? 1,
            options: q.options ?? [],
            expectedAnswer: q.expectedAnswer ?? '',
            timeLimit: q.timeLimit ?? null,
            order: order++,
        }));

        const created = await questionModel.insertMany(docs);
        await recomputeTestTotals(testId);

        await saveLog({
            action: `${req.user.firstName} generated ${created.length} AI questions for test ${test.title}`,
            actorId: req.user._id,
        });

        return res.status(201).json({ status: true, questions: created });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

module.exports = {
    listTests,
    listAllTests,
    createTest,
    getTest,
    updateTest,
    deleteTest,
    assignTest,
    unassignTest,
    reorderOfferTests,
    recomputeTestTotals,
    generateAiQuestions,
};
