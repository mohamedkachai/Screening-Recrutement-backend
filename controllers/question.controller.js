const questionModel = require('../models/question.model');
const testModel = require('../models/test.model');
const {
    createQuestionSchema,
    updateQuestionSchema,
    reorderQuestionsSchema,
} = require('../schemas/test.schema');
const { recomputeTestTotals } = require('./test.controller');
const { saveLog } = require('../utils/logger');

async function createQuestion(req, res) {
    try {
        const validation = createQuestionSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const test = await testModel.findById(req.params.testId);
        if (!test) {
            return res.status(404).json({ status: false, message: 'Test not found' });
        }

        let { order } = req.body;
        if (order == null) {
            const last = await questionModel.findOne({ testId: test._id }).sort({ order: -1 });
            order = last ? last.order + 1 : 0;
        }

        const question = await questionModel.create({
            ...req.body,
            order,
            testId: test._id,
        });

        await recomputeTestTotals(test._id);

        await saveLog({
            action: `${req.user.firstName} added a question to test "${test.title}"`,
            actorId: req.user._id,
        });

        return res.status(201).json({ status: true, question, message: 'Question added' });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function updateQuestion(req, res) {
    try {
        const validation = updateQuestionSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const question = await questionModel.findByIdAndUpdate(req.params.questionId, req.body, {
            new: true,
            runValidators: true,
        });

        if (!question) {
            return res.status(404).json({ status: false, message: 'Question not found' });
        }

        await recomputeTestTotals(question.testId);

        return res.status(200).json({ status: true, question, message: 'Question updated' });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function deleteQuestion(req, res) {
    try {
        const question = await questionModel.findById(req.params.questionId);

        if (!question) {
            return res.status(404).json({ status: false, message: 'Question not found' });
        }

        const { testId } = question;
        await questionModel.findByIdAndDelete(question._id);
        await recomputeTestTotals(testId);

        return res.status(204).json();
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function reorderQuestions(req, res) {
    try {
        const validation = reorderQuestionsSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.flatten() });
        }

        const { orderedIds } = req.body;

        await Promise.all(
            orderedIds.map((id, index) =>
                questionModel.updateOne(
                    { _id: id, testId: req.params.testId },
                    { $set: { order: index } }
                )
            )
        );

        return res.status(200).json({ status: true, message: 'Questions reordered' });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

module.exports = {
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
};
