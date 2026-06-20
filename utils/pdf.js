const PDFDocument = require('pdfkit');
const { QUESTION_TYPES } = require('../models/enums');

const COLORS = {
    primary: '#1677ff',
    text: '#222',
    muted: '#666',
    border: '#e1e6ef',
    success: '#13a868',
    danger: '#cf1322',
    warning: '#fa8c16',
};

function hr(doc) {
    doc.moveDown(0.5);
    doc
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
    doc.moveDown(0.5);
}

function header(doc, title, subtitle) {
    doc
        .rect(0, 0, doc.page.width, 70)
        .fill(COLORS.primary);
    doc
        .fillColor('#fff')
        .fontSize(20)
        .text(title, 50, 22);
    if (subtitle) {
        doc.fontSize(11).fillColor('#dbe9ff').text(subtitle, 50, 48);
    }
    doc.fillColor(COLORS.text).y = 90;
    doc.x = 50;
}

function kv(doc, label, value) {
    const startY = doc.y;
    doc.fontSize(10).fillColor(COLORS.muted).text(label, 50, startY, { width: 140 });
    doc
        .fontSize(11)
        .fillColor(COLORS.text)
        .text(String(value ?? '-'), 200, startY, { width: 350 });
    doc.y = Math.max(doc.y, startY + 18);
    doc.x = 50;
}

function sectionTitle(doc, text) {
    doc.moveDown(0.6);
    doc.x = 50;
    doc
        .fontSize(13)
        .fillColor(COLORS.primary)
        .text(text);
    hr(doc);
    doc.fillColor(COLORS.text);
}

function answerText(question, value) {
    if (value == null || value === '') {
        return '— No answer —';
    }
    switch (question.type) {
        case QUESTION_TYPES.MCQ_SINGLE:
        case QUESTION_TYPES.TRUE_FALSE: {
            const opt = question.options.find((o) => String(o._id) === String(value));
            return opt ? opt.text : String(value);
        }
        case QUESTION_TYPES.MCQ_MULTI: {
            const ids = Array.isArray(value) ? value.map(String) : [];
            return question.options
                .filter((o) => ids.includes(String(o._id)))
                .map((o) => `• ${o.text}`)
                .join('\n');
        }
        default:
            return String(value);
    }
}

/**
 * Per-candidate attempt PDF report.
 *
 * @param {Object} ctx { attempt, questions, tests, candidate, offer }
 * @param {NodeJS.WritableStream} stream
 */
function buildAttemptReport({ attempt, questions, tests, candidate, offer }, stream) {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    doc.pipe(stream);

    const qMap = new Map(questions.map((q) => [String(q._id), q]));
    const tMap = new Map(tests.map((t) => [String(t._id), t]));
    const candidateName =
        `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() ||
        candidate?.email ||
        'Candidate';

    header(doc, 'Assessment Report', `${offer?.title || ''} · ${candidateName}`);

    sectionTitle(doc, 'Candidate');
    kv(doc, 'Name', candidateName);
    kv(doc, 'Email', candidate?.email);
    kv(doc, 'Phone', candidate?.phone);
    kv(doc, 'Country', candidate?.country);
    kv(doc, 'Years of experience', candidate?.yearsOfExperience);

    sectionTitle(doc, 'Offer');
    kv(doc, 'Title', offer?.title);
    kv(doc, 'Type', offer?.type);
    kv(doc, 'Location', offer?.location);
    kv(doc, 'Work mode', offer?.workMode);

    sectionTitle(doc, 'Attempt');
    kv(doc, 'Status', attempt.status);
    kv(doc, 'Started', attempt.startedAt ? new Date(attempt.startedAt).toLocaleString() : '-');
    kv(doc, 'Submitted', attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '-');
    kv(doc, 'Auto score', attempt.autoScore);
    kv(doc, 'Manual score', attempt.manualScore);
    kv(
        doc,
        'Total',
        `${attempt.totalScore} / ${attempt.maxScore}` +
            (attempt.maxScore
                ? ` (${Math.round((attempt.totalScore / attempt.maxScore) * 100)}%)`
                : '')
    );
    kv(doc, 'Tab switches', attempt.tabSwitchCount);
    kv(doc, 'Fullscreen exits', attempt.fullscreenExitCount);
    kv(doc, 'Auto-submitted', attempt.autoSubmitted ? 'Yes' : 'No');

    sectionTitle(doc, 'Answers');
    let qNum = 0;
    for (const group of attempt.plan) {
        const test = tMap.get(String(group.testId));
        doc.moveDown(0.4);
        doc
            .fontSize(12)
            .fillColor(COLORS.primary)
            .text(test?.title || 'Test');
        doc.fillColor(COLORS.text);

        for (const qid of group.questionIds) {
            const q = qMap.get(String(qid));
            if (!q) continue;
            qNum += 1;
            const answer = attempt.answers.find(
                (a) => String(a.questionId) === String(qid)
            );
            const earned = (answer?.autoPoints || 0) + (answer?.manualPoints || 0);

            doc.moveDown(0.6);
            if (doc.y > doc.page.height - 120) {
                doc.addPage();
            }
            doc
                .fontSize(10)
                .fillColor(COLORS.muted)
                .text(`Q${qNum} · ${q.type} · ${earned}/${q.points} pt`);
            doc
                .fontSize(11)
                .fillColor(COLORS.text)
                .text(q.prompt, { width: 500 });
            doc.moveDown(0.2);
            doc
                .fontSize(10)
                .fillColor(COLORS.muted)
                .text('Answer:');
            doc
                .fontSize(10)
                .fillColor(COLORS.text)
                .text(answerText(q, answer?.value), { width: 500 });

            if (answer?.manualFeedback) {
                doc
                    .fontSize(9)
                    .fillColor(COLORS.warning)
                    .text(`Reviewer feedback: ${answer.manualFeedback}`, { width: 500 });
            }
        }
    }

    // Footer with page numbers
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const bottom = doc.page.height - 30;
        doc
            .fontSize(9)
            .fillColor(COLORS.muted)
            .text(
                `Page ${i + 1} of ${range.count} · Generated ${new Date().toLocaleString()}`,
                50,
                bottom,
                { width: doc.page.width - 100, align: 'center' }
            );
    }

    doc.end();
}

/**
 * Per-offer recap PDF: ranking + summary stats.
 *
 * @param {Object} ctx { offer, attempts (with candidate populated) }
 */
function buildOfferRecap({ offer, attempts }, stream) {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    doc.pipe(stream);

    header(doc, 'Offer Recap', offer?.title || '');

    sectionTitle(doc, 'Summary');
    const total = attempts.length;
    const submitted = attempts.filter(
        (a) => a.status === 'SUBMITTED' || a.status === 'GRADED'
    ).length;
    const graded = attempts.filter((a) => a.status === 'GRADED').length;
    const avg =
        attempts.length && attempts.some((a) => a.maxScore)
            ? Math.round(
                  (attempts.reduce(
                      (s, a) => s + (a.maxScore ? (a.totalScore / a.maxScore) * 100 : 0),
                      0
                  ) /
                      attempts.length) *
                      10
              ) / 10
            : 0;

    kv(doc, 'Total attempts', total);
    kv(doc, 'Submitted', submitted);
    kv(doc, 'Fully graded', graded);
    kv(doc, 'Average %', `${avg}%`);

    sectionTitle(doc, 'Ranking');

    // Sort by % desc
    const ranked = [...attempts].sort((a, b) => {
        const ap = a.maxScore ? a.totalScore / a.maxScore : 0;
        const bp = b.maxScore ? b.totalScore / b.maxScore : 0;
        return bp - ap;
    });

    // Table header
    const startX = 50;
    const widths = [30, 200, 180, 60, 60];
    const labels = ['#', 'Candidate', 'Email', 'Score', 'Status'];
    let y = doc.y;

    doc.fontSize(10).fillColor(COLORS.muted);
    let x = startX;
    labels.forEach((label, i) => {
        doc.text(label, x, y, { width: widths[i] });
        x += widths[i];
    });
    doc.y = y + 14;
    hr(doc);
    doc.fillColor(COLORS.text);

    ranked.forEach((a, idx) => {
        if (doc.y > doc.page.height - 60) {
            doc.addPage();
        }
        const rowY = doc.y;
        const candidateName =
            `${a.candidateId?.firstName || ''} ${a.candidateId?.lastName || ''}`.trim() ||
            '(deleted)';
        const score = a.maxScore
            ? `${a.totalScore}/${a.maxScore} (${Math.round(
                  (a.totalScore / a.maxScore) * 100
              )}%)`
            : '-';
        const cells = [
            String(idx + 1),
            candidateName,
            a.candidateId?.email || '-',
            score,
            a.status,
        ];
        let cx = startX;
        doc.fontSize(10).fillColor(COLORS.text);
        cells.forEach((cell, i) => {
            doc.text(cell, cx, rowY, { width: widths[i] });
            cx += widths[i];
        });
        doc.y = rowY + 16;
    });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const bottom = doc.page.height - 30;
        doc
            .fontSize(9)
            .fillColor(COLORS.muted)
            .text(
                `Page ${i + 1} of ${range.count} · Generated ${new Date().toLocaleString()}`,
                50,
                bottom,
                { width: doc.page.width - 100, align: 'center' }
            );
    }

    doc.end();
}

module.exports = { buildAttemptReport, buildOfferRecap };
