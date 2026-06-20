const attemptModel = require('../models/attempt.model');
const offerModel = require('../models/offer.model');
const questionModel = require('../models/question.model');
const testModel = require('../models/test.model');
const { buildAttemptReport, buildOfferRecap } = require('../utils/pdf');

function safeFilename(s) {
    return String(s || 'export').replace(/[^a-z0-9\-_]+/gi, '_').slice(0, 80);
}

async function exportAttemptPdf(req, res) {
    try {
        const attempt = await attemptModel
            .findById(req.params.attemptId)
            .populate(
                'candidateId',
                'firstName lastName email phone country yearsOfExperience'
            )
            .populate('offerId', 'title type location workMode');

        if (!attempt) {
            return res.status(404).json({ status: false, message: 'Attempt not found' });
        }

        const allQuestionIds = attempt.plan.flatMap((p) => p.questionIds);
        const [questions, tests] = await Promise.all([
            questionModel.find({ _id: { $in: allQuestionIds } }),
            testModel
                .find({ _id: { $in: attempt.plan.map((p) => p.testId) } })
                .select('title order'),
        ]);

        const candidate = attempt.candidateId;
        const offer = attempt.offerId;
        const filename = `report_${safeFilename(offer?.title)}_${safeFilename(
            candidate?.lastName || candidate?.email
        )}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        buildAttemptReport({ attempt, questions, tests, candidate, offer }, res);
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function exportOfferRecapPdf(req, res) {
    try {
        const offer = await offerModel.findById(req.params.offerId);
        if (!offer) {
            return res.status(404).json({ status: false, message: 'Offer not found' });
        }

        const attempts = await attemptModel
            .find({ offerId: offer._id })
            .populate('candidateId', 'firstName lastName email')
            .sort({ totalScore: -1 });

        const filename = `recap_${safeFilename(offer.title)}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        buildOfferRecap({ offer, attempts }, res);
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

module.exports = {
    exportAttemptPdf,
    exportOfferRecapPdf,
};
