const attemptModel = require('../models/attempt.model');
const sessionModel = require('../models/session.model');
const offerModel = require('../models/offer.model');
const applicationModel = require('../models/application.model');
const testModel = require('../models/test.model');
const questionModel = require('../models/question.model');
const { ATTEMPT_STATUSES, APPLICATION_STATUSES } = require('../models/enums');
const { deriveStatus } = require('./session.controller');
const { gradeAnswer } = require('../utils/grader');
const {
    notifyAttemptSubmitted,
    notifyHrAttemptSubmitted,
    notifyResultsReady,
    sendCandidateReport,
} = require('../utils/notifications');
const userModel = require('../models/user.model');
const { saveLog } = require('../utils/logger');

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Strip correct answers / expected answers from a question for candidate consumption.
 */
function sanitizeQuestion(q) {
    return {
        _id: q._id,
        testId: q.testId,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        options: (q.options || []).map((o) => ({ _id: o._id, text: o.text })),
    };
}

/**
 * Build the candidate-facing payload: plan + sanitized questions.
 */
async function buildRunnerPayload(attempt) {
    const allQuestionIds = attempt.plan.flatMap((p) => p.questionIds);
    const [questions, tests] = await Promise.all([
        questionModel.find({ _id: { $in: allQuestionIds } }),
        testModel
            .find({ _id: { $in: attempt.plan.map((p) => p.testId) } })
            .select('title description durationMinutes order'),
    ]);
    const qMap = new Map(questions.map((q) => [String(q._id), q]));
    const tMap = new Map(tests.map((t) => [String(t._id), t]));

    return attempt.plan.map((p) => ({
        test: tMap.get(String(p.testId)),
        questions: p.questionIds
            .map((qid) => qMap.get(String(qid)))
            .filter(Boolean)
            .map(sanitizeQuestion),
    }));
}

function buildAnswerSummary(attempt) {
    const map = {};
    for (const a of attempt.answers) {
        map[String(a.questionId)] = a.value;
    }
    return map;
}

async function autoExpireIfNeeded(attempt) {
    if (
        attempt.status === ATTEMPT_STATUSES.IN_PROGRESS &&
        attempt.expiresAt &&
        attempt.expiresAt < new Date()
    ) {
        await finalizeAttempt(attempt, { autoSubmitted: true });
    }
}

/**
 * Auto-grade all answers, persist scores, set status SUBMITTED (or GRADED if no manual needed).
 */
async function finalizeAttempt(attempt, { autoSubmitted = false } = {}) {
    const allQuestionIds = attempt.plan.flatMap((p) => p.questionIds);
    const questions = await questionModel.find({ _id: { $in: allQuestionIds } });
    const qMap = new Map(questions.map((q) => [String(q._id), q]));

    const maxScore = questions.reduce((s, q) => s + (q.points || 0), 0);
    const answerMap = new Map(attempt.answers.map((a) => [String(a.questionId), a]));

    const gradedAnswers = [];
    let autoScore = 0;
    let needsAnyManual = false;

    for (const q of questions) {
        const existing = answerMap.get(String(q._id));
        const value = existing?.value;
        const { points, needsManualGrading } = gradeAnswer(q, value);

        autoScore += points;
        if (needsManualGrading && value != null && value !== '') {
            needsAnyManual = true;
        }

        gradedAnswers.push({
            testId: q.testId,
            questionId: q._id,
            value: value ?? null,
            autoPoints: points,
            manualPoints: needsManualGrading ? null : 0,
            manualFeedback: existing?.manualFeedback || '',
            graded: !needsManualGrading,
            needsManualGrading,
        });
    }

    attempt.answers = gradedAnswers;
    attempt.autoScore = autoScore;
    attempt.manualScore = 0;
    attempt.totalScore = autoScore;
    attempt.maxScore = maxScore;
    attempt.submittedAt = new Date();
    attempt.status = needsAnyManual ? ATTEMPT_STATUSES.SUBMITTED : ATTEMPT_STATUSES.GRADED;
    if (autoSubmitted) {
        attempt.autoSubmitted = true;
        attempt.events.push({ type: 'AUTO_SUBMITTED', at: new Date() });
    }
    await attempt.save();

    // Mark application as completed and handle auto-reject
    if (attempt.applicationId) {
        const offer = await offerModel.findById(attempt.offerId).select('autoRejectThreshold title');
        const threshold = offer?.autoRejectThreshold ?? 0;
        const pct = attempt.maxScore > 0 ? (attempt.totalScore / attempt.maxScore) * 100 : 0;
        const applicationStatus =
            threshold > 0 && pct < threshold
                ? APPLICATION_STATUSES.REJECTED
                : APPLICATION_STATUSES.COMPLETED;
        await applicationModel.findByIdAndUpdate(attempt.applicationId, {
            status: applicationStatus,
        });

        // Send PDF report if fully auto-graded
        if (attempt.status === ATTEMPT_STATUSES.GRADED) {
            const candidate = await userModel.findById(attempt.candidateId);
            if (candidate && offer) {
                const allQuestionIds = attempt.answers.map((a) => a.questionId);
                const [questions, tests] = await Promise.all([
                    questionModel.find({ _id: { $in: allQuestionIds } }),
                    testModel.find({ _id: { $in: attempt.tests.map((t) => t.testId) } }),
                ]);
                sendCandidateReport(candidate, offer, attempt, questions, tests).catch(() => {});
            }
        }
    }

    return attempt;
}

// =====================================================================
// CANDIDATE ENDPOINTS
// =====================================================================

async function getMyAttempt(req, res) {
    try {
        const { offerId } = req.params;

        const offer = await offerModel.findById(offerId).select('_id title status');
        if (!offer) {
            return res.status(404).json({ status: false, message: 'Offer not found' });
        }

        const session = await sessionModel.findOne({ offerId });
        if (!session) {
            return res.status(404).json({ status: false, message: 'No session scheduled' });
        }

        let attempt = await attemptModel.findOne({
            offerId,
            candidateId: req.user._id,
        });

        if (attempt) {
            await autoExpireIfNeeded(attempt);
            attempt = await attemptModel.findById(attempt._id);
        }

        const payload = {
            status: true,
            offer,
            session: {
                _id: session._id,
                startAt: session.startAt,
                endAt: session.endAt,
                instructions: session.instructions,
                randomizeQuestions: session.randomizeQuestions,
                tabSwitchLimit: session.tabSwitchLimit,
                preventCopyPaste: session.preventCopyPaste,
                requireFullscreen: session.requireFullscreen,
                allowedAttempts: session.allowedAttempts,
            },
            sessionStatus: deriveStatus(session),
            attempt: null,
            plan: null,
            answers: null,
        };

        if (attempt) {
            payload.attempt = {
                _id: attempt._id,
                status: attempt.status,
                startedAt: attempt.startedAt,
                submittedAt: attempt.submittedAt,
                expiresAt: attempt.expiresAt,
                tabSwitchCount: attempt.tabSwitchCount,
                fullscreenExitCount: attempt.fullscreenExitCount,
                autoSubmitted: attempt.autoSubmitted,
                totalScore: attempt.totalScore,
                maxScore: attempt.maxScore,
            };
            if (
                attempt.status === ATTEMPT_STATUSES.IN_PROGRESS ||
                attempt.status === ATTEMPT_STATUSES.NOT_STARTED
            ) {
                payload.plan = await buildRunnerPayload(attempt);
                payload.answers = buildAnswerSummary(attempt);
            }
        }

        return res.status(200).json(payload);
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function startAttempt(req, res) {
    try {
        const { offerId } = req.params;

        const session = await sessionModel.findOne({ offerId });
        if (!session) {
            return res.status(404).json({ status: false, message: 'No session scheduled' });
        }

        const sessionStatus = deriveStatus(session);
        if (sessionStatus !== 'ACTIVE') {
            return res
                .status(400)
                .json({ status: false, message: `Session is ${sessionStatus.toLowerCase()}` });
        }

        const application = await applicationModel.findOne({
            offerId,
            candidateId: req.user._id,
        });
        if (!application) {
            return res
                .status(403)
                .json({ status: false, message: 'You must apply to this offer first' });
        }

        let attempt = await attemptModel.findOne({ offerId, candidateId: req.user._id });

        if (attempt && attempt.status !== ATTEMPT_STATUSES.NOT_STARTED) {
            if (
                attempt.status === ATTEMPT_STATUSES.SUBMITTED ||
                attempt.status === ATTEMPT_STATUSES.GRADED
            ) {
                return res
                    .status(400)
                    .json({ status: false, message: 'You have already submitted this attempt' });
            }
            // resume in-progress attempt
        } else {
            // build plan
            const offer = await offerModel.findById(offerId).populate('testIds');
            const tests = offer?.testIds ?? [];
            const plan = [];
            for (const t of tests) {
                let questions = await questionModel.find({ testId: t._id }).select('_id');
                if (session.randomizeQuestions) {
                    questions = shuffle(questions);
                } else {
                    questions = questions.sort((a, b) => (a.order || 0) - (b.order || 0));
                }
                plan.push({
                    testId: t._id,
                    questionIds: questions.map((q) => q._id),
                });
            }

            const totalDurationMinutes = tests.reduce(
                (sum, t) => sum + (t.durationMinutes || 0),
                0
            );
            const now = new Date();
            const candidateExpiry = new Date(now.getTime() + totalDurationMinutes * 60 * 1000);
            const expiresAt = candidateExpiry < session.endAt ? candidateExpiry : session.endAt;

            if (!attempt) {
                attempt = await attemptModel.create({
                    offerId,
                    sessionId: session._id,
                    applicationId: application._id,
                    candidateId: req.user._id,
                    status: ATTEMPT_STATUSES.IN_PROGRESS,
                    plan,
                    startedAt: now,
                    expiresAt,
                });
            } else {
                attempt.plan = plan;
                attempt.startedAt = now;
                attempt.expiresAt = expiresAt;
                attempt.status = ATTEMPT_STATUSES.IN_PROGRESS;
                await attempt.save();
            }

            // mark application IN_PROGRESS
            if (application.status !== APPLICATION_STATUSES.IN_PROGRESS) {
                application.status = APPLICATION_STATUSES.IN_PROGRESS;
                await application.save();
            }

            await saveLog({
                action: `${req.user.firstName} started attempt for offer ${offerId}`,
                actorId: req.user._id,
            });
        }

        const plan = await buildRunnerPayload(attempt);
        return res.status(200).json({
            status: true,
            attempt: {
                _id: attempt._id,
                status: attempt.status,
                startedAt: attempt.startedAt,
                expiresAt: attempt.expiresAt,
                tabSwitchCount: attempt.tabSwitchCount,
                fullscreenExitCount: attempt.fullscreenExitCount,
            },
            plan,
            answers: buildAnswerSummary(attempt),
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function saveAnswer(req, res) {
    try {
        const { attemptId } = req.params;
        const { questionId, value } = req.body;

        const attempt = await attemptModel.findById(attemptId);
        if (!attempt) {
            return res.status(404).json({ status: false, message: 'Attempt not found' });
        }
        if (String(attempt.candidateId) !== String(req.user._id)) {
            return res.status(403).json({ status: false, message: 'Forbidden' });
        }
        if (attempt.status !== ATTEMPT_STATUSES.IN_PROGRESS) {
            return res.status(400).json({ status: false, message: 'Attempt is not active' });
        }
        if (attempt.expiresAt && attempt.expiresAt < new Date()) {
            await finalizeAttempt(attempt, { autoSubmitted: true });
            return res.status(400).json({ status: false, message: 'Attempt expired' });
        }

        const question = await questionModel.findById(questionId);
        if (!question) {
            return res.status(404).json({ status: false, message: 'Question not found' });
        }

        const idx = attempt.answers.findIndex(
            (a) => String(a.questionId) === String(questionId)
        );
        const next = {
            testId: question.testId,
            questionId: question._id,
            value,
            autoPoints: 0,
            manualPoints: null,
            graded: false,
            needsManualGrading: false,
        };

        if (idx >= 0) {
            attempt.answers[idx] = { ...attempt.answers[idx].toObject?.() ?? attempt.answers[idx], ...next };
        } else {
            attempt.answers.push(next);
        }
        await attempt.save();

        return res.status(200).json({ status: true });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function recordEvent(req, res) {
    try {
        const { attemptId } = req.params;
        const { type } = req.body;

        const allowed = ['TAB_SWITCH', 'FULLSCREEN_EXIT', 'COPY_PASTE_BLOCKED'];
        if (!allowed.includes(type)) {
            return res.status(400).json({ status: false, message: 'Invalid event type' });
        }

        const attempt = await attemptModel.findById(attemptId);
        if (!attempt) {
            return res.status(404).json({ status: false, message: 'Attempt not found' });
        }
        if (String(attempt.candidateId) !== String(req.user._id)) {
            return res.status(403).json({ status: false, message: 'Forbidden' });
        }
        if (attempt.status !== ATTEMPT_STATUSES.IN_PROGRESS) {
            return res.status(200).json({ status: true });
        }

        attempt.events.push({ type, at: new Date() });
        if (type === 'TAB_SWITCH') {
            attempt.tabSwitchCount += 1;
        }
        if (type === 'FULLSCREEN_EXIT') {
            attempt.fullscreenExitCount += 1;
        }

        // auto-submit if exceeded
        const session = await sessionModel.findById(attempt.sessionId);
        let autoSubmitted = false;
        if (
            session &&
            session.tabSwitchLimit > 0 &&
            attempt.tabSwitchCount > session.tabSwitchLimit
        ) {
            await attempt.save();
            await finalizeAttempt(attempt, { autoSubmitted: true });

            const offer = await offerModel.findById(attempt.offerId);
            if (offer) {
                await notifyAttemptSubmitted(req.user, offer, attempt);
                if (offer.createdBy) {
                    const recruiter = await userModel.findById(offer.createdBy);
                    await notifyHrAttemptSubmitted(recruiter, req.user, offer, attempt);
                }
                if (attempt.status === ATTEMPT_STATUSES.GRADED) {
                    await notifyResultsReady(req.user, offer, attempt);
                }
            }

            autoSubmitted = true;
        } else {
            await attempt.save();
        }

        return res.status(200).json({
            status: true,
            tabSwitchCount: attempt.tabSwitchCount,
            fullscreenExitCount: attempt.fullscreenExitCount,
            autoSubmitted,
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function submitAttempt(req, res) {
    try {
        const { attemptId } = req.params;

        const attempt = await attemptModel.findById(attemptId);
        if (!attempt) {
            return res.status(404).json({ status: false, message: 'Attempt not found' });
        }
        if (String(attempt.candidateId) !== String(req.user._id)) {
            return res.status(403).json({ status: false, message: 'Forbidden' });
        }
        if (attempt.status !== ATTEMPT_STATUSES.IN_PROGRESS) {
            return res.status(400).json({ status: false, message: 'Attempt already finalized' });
        }

        await finalizeAttempt(attempt);
        await saveLog({
            action: `${req.user.firstName} submitted attempt ${attempt._id}`,
            actorId: req.user._id,
        });

        // Notifications
        const offer = await offerModel.findById(attempt.offerId);
        await notifyAttemptSubmitted(req.user, offer, attempt);
        if (offer?.createdBy) {
            const recruiter = await userModel.findById(offer.createdBy);
            await notifyHrAttemptSubmitted(recruiter, req.user, offer, attempt);
        }
        if (attempt.status === ATTEMPT_STATUSES.GRADED) {
            await notifyResultsReady(req.user, offer, attempt);
        }

        return res.status(200).json({
            status: true,
            attempt: {
                _id: attempt._id,
                status: attempt.status,
                submittedAt: attempt.submittedAt,
                autoScore: attempt.autoScore,
                totalScore: attempt.totalScore,
                maxScore: attempt.maxScore,
            },
            message: 'Attempt submitted',
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

// =====================================================================
// HR / REVIEWER ENDPOINTS
// =====================================================================

async function listAttemptsByOffer(req, res) {
    try {
        const { offerId } = req.params;

        const attempts = await attemptModel
            .find({ offerId })
            .populate('candidateId', 'firstName lastName email')
            .sort({ submittedAt: -1, createdAt: -1 });

        return res.status(200).json({ status: true, attempts });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function listAllAttempts(req, res) {
    try {
        const { status, q } = req.query;

        const filter = {};
        if (status) {
            filter.status = status;
        }

        let attempts = await attemptModel
            .find(filter)
            .populate('candidateId', 'firstName lastName email')
            .populate('offerId', 'title type')
            .sort({ submittedAt: -1, createdAt: -1 })
            .lean();

        if (q) {
            const needle = String(q).toLowerCase();
            attempts = attempts.filter((a) => {
                const fullName = `${a.candidateId?.firstName || ''} ${a.candidateId?.lastName || ''}`.toLowerCase();
                return (
                    fullName.includes(needle) ||
                    (a.candidateId?.email || '').toLowerCase().includes(needle) ||
                    (a.offerId?.title || '').toLowerCase().includes(needle)
                );
            });
        }

        return res.status(200).json({ status: true, attempts });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function getAttemptDetail(req, res) {
    try {
        const attempt = await attemptModel
            .findById(req.params.attemptId)
            .populate('candidateId', 'firstName lastName email')
            .populate('offerId', 'title');

        if (!attempt) {
            return res.status(404).json({ status: false, message: 'Attempt not found' });
        }

        const allQuestionIds = attempt.plan.flatMap((p) => p.questionIds);
        const [questions, tests] = await Promise.all([
            questionModel.find({ _id: { $in: allQuestionIds } }),
            testModel
                .find({ _id: { $in: attempt.plan.map((p) => p.testId) } })
                .select('title durationMinutes order'),
        ]);

        return res
            .status(200)
            .json({ status: true, attempt, questions, tests });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

async function gradeAttempt(req, res) {
    try {
        const { attemptId } = req.params;
        const { grades } = req.body; // [{ questionId, points, feedback }]

        if (!Array.isArray(grades)) {
            return res.status(400).json({ status: false, message: 'grades must be an array' });
        }

        const attempt = await attemptModel.findById(attemptId);
        if (!attempt) {
            return res.status(404).json({ status: false, message: 'Attempt not found' });
        }
        if (
            attempt.status !== ATTEMPT_STATUSES.SUBMITTED &&
            attempt.status !== ATTEMPT_STATUSES.GRADED
        ) {
            return res
                .status(400)
                .json({ status: false, message: 'Attempt is not ready for grading' });
        }

        const gradeMap = new Map(grades.map((g) => [String(g.questionId), g]));

        for (const a of attempt.answers) {
            if (!a.needsManualGrading) {
                continue;
            }
            const g = gradeMap.get(String(a.questionId));
            if (g && typeof g.points === 'number') {
                a.manualPoints = Math.max(0, g.points);
                a.manualFeedback = g.feedback || '';
                a.graded = true;
            }
        }

        // recompute scores
        let manualScore = 0;
        let allManualDone = true;
        for (const a of attempt.answers) {
            if (a.needsManualGrading) {
                if (a.manualPoints == null) {
                    allManualDone = false;
                } else {
                    manualScore += a.manualPoints;
                }
            }
        }
        attempt.manualScore = manualScore;
        attempt.totalScore = (attempt.autoScore || 0) + manualScore;
        if (allManualDone) {
            attempt.status = ATTEMPT_STATUSES.GRADED;
        }
        await attempt.save();

        await saveLog({
            action: `${req.user.firstName} graded attempt ${attempt._id}`,
            actorId: req.user._id,
        });

        if (attempt.status === ATTEMPT_STATUSES.GRADED) {
            const [candidate, offer] = await Promise.all([
                userModel.findById(attempt.candidateId),
                offerModel.findById(attempt.offerId),
            ]);
            if (candidate && offer) {
                // Auto-reject if below threshold
                if (attempt.applicationId) {
                    const threshold = offer.autoRejectThreshold ?? 0;
                    const pct = attempt.maxScore > 0 ? (attempt.totalScore / attempt.maxScore) * 100 : 0;
                    if (threshold > 0 && pct < threshold) {
                        await applicationModel.findByIdAndUpdate(attempt.applicationId, {
                            status: APPLICATION_STATUSES.REJECTED,
                        });
                    }
                }
                await notifyResultsReady(candidate, offer, attempt);

                // Send PDF report to candidate
                const allQuestionIds = attempt.answers.map((a) => a.questionId);
                const [questions, tests] = await Promise.all([
                    questionModel.find({ _id: { $in: allQuestionIds } }),
                    testModel.find({ _id: { $in: attempt.tests.map((t) => t.testId) } }),
                ]);
                sendCandidateReport(candidate, offer, attempt, questions, tests).catch(() => {});
            }
        }

        return res.status(200).json({ status: true, attempt, message: 'Grades saved' });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
}

module.exports = {
    getMyAttempt,
    startAttempt,
    saveAnswer,
    recordEvent,
    submitAttempt,
    listAttemptsByOffer,
    listAllAttempts,
    getAttemptDetail,
    gradeAttempt,
    finalizeAttempt,
};
