const { QUESTION_TYPES } = require('../models/enums');

/**
 * Auto-grade a single question given the candidate's value.
 * Returns { points, needsManualGrading }.
 */
function gradeAnswer(question, value) {
    const points = question.points || 0;

    switch (question.type) {
        case QUESTION_TYPES.MCQ_SINGLE:
        case QUESTION_TYPES.TRUE_FALSE: {
            const correct = question.options.find((o) => o.isCorrect);
            if (!correct || value == null) {
                return { points: 0, needsManualGrading: false };
            }
            return {
                points: String(value) === String(correct._id) ? points : 0,
                needsManualGrading: false,
            };
        }
        case QUESTION_TYPES.MCQ_MULTI: {
            const correctIds = question.options
                .filter((o) => o.isCorrect)
                .map((o) => String(o._id))
                .sort();
            const selected = Array.isArray(value) ? value.map(String).sort() : [];
            const isExact =
                selected.length === correctIds.length &&
                selected.every((id, i) => id === correctIds[i]);
            return { points: isExact ? points : 0, needsManualGrading: false };
        }
        case QUESTION_TYPES.SHORT_TEXT: {
            if (typeof value !== 'string' || !question.expectedAnswer) {
                return { points: 0, needsManualGrading: false };
            }
            const a = question.caseSensitive ? value : value.toLowerCase();
            const b = question.caseSensitive
                ? question.expectedAnswer
                : question.expectedAnswer.toLowerCase();
            return {
                points: a.trim() === b.trim() ? points : 0,
                needsManualGrading: false,
            };
        }
        case QUESTION_TYPES.ESSAY:
        case QUESTION_TYPES.CODE:
            return { points: 0, needsManualGrading: true };
        default:
            return { points: 0, needsManualGrading: false };
    }
}

module.exports = { gradeAnswer };
