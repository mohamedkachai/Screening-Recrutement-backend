/**
 * Seed script — creates demo IT tests, an open offer with a session, demo users,
 * and wires everything together so you can immediately test:
 *   - Candidate: browse offer → apply → take test
 *   - Reviewer:  view results → grade essay / code answers
 *
 * Usage:
 *   node utils/seedTests.js
 *
 * Idempotent: safe to run multiple times (skips already-existing items).
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const userModel        = require('../models/user.model');
const testModel        = require('../models/test.model');
const questionModel    = require('../models/question.model');
const offerModel       = require('../models/offer.model');
const sessionModel     = require('../models/session.model');
const applicationModel = require('../models/application.model');
const { ROLES, OFFER_STATUSES, APPLICATION_STATUSES } = require('../models/enums');

// ─── helpers ────────────────────────────────────────────────────────────────

async function findOrCreateUser({ email, firstName, lastName, role }) {
    const existing = await userModel.findOne({ email });
    if (existing) { console.log(`  [skip] user ${email} already exists`); return existing; }
    const password = 'Test@12345';
    const user = await userModel.create({
        email, firstName, lastName, role,
        password, confirmPassword: password,
        profileCompleted: true,
    });
    console.log(`  [+] created ${role} user: ${email}  (password: Test@12345)`);
    return user;
}

async function findOrCreateTest({ title, createdBy }) {
    const existing = await testModel.findOne({ title });
    if (existing) { console.log(`  [skip] test "${title}" already exists`); return existing; }
    const test = await testModel.create({
        title, createdBy,
        description: `Auto-generated seed test: ${title}`,
        durationMinutes: 30,
        passingScore: 60,
    });
    console.log(`  [+] created test "${title}"`);
    return test;
}

async function addQuestions(test, questions) {
    const existing = await questionModel.countDocuments({ testId: test._id });
    if (existing > 0) { console.log(`  [skip] questions already exist for "${test.title}"`); return; }

    let totalPoints = 0;
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await questionModel.create({ ...q, testId: test._id, order: i });
        totalPoints += q.points ?? 1;
    }
    await testModel.findByIdAndUpdate(test._id, {
        questionCount: questions.length,
        totalPoints,
    });
    console.log(`  [+] added ${questions.length} questions to "${test.title}" (${totalPoints} pts)`);
}

// ─── data ───────────────────────────────────────────────────────────────────

const JS_QUESTIONS = [
    {
        type: 'MCQ_SINGLE', points: 2,
        prompt: 'Which keyword declares a block-scoped variable in JavaScript?',
        options: [
            { text: 'var',   isCorrect: false },
            { text: 'let',   isCorrect: true  },
            { text: 'def',   isCorrect: false },
            { text: 'const', isCorrect: false },
        ],
    },
    {
        type: 'MCQ_SINGLE', points: 2,
        prompt: 'What does `typeof null` return in JavaScript?',
        options: [
            { text: '"null"',    isCorrect: false },
            { text: '"object"',  isCorrect: true  },
            { text: '"undefined"', isCorrect: false },
            { text: '"boolean"', isCorrect: false },
        ],
    },
    {
        type: 'TRUE_FALSE', points: 1,
        prompt: 'Arrow functions have their own `this` binding.',
        options: [
            { text: 'True',  isCorrect: false },
            { text: 'False', isCorrect: true  },
        ],
    },
    {
        type: 'MCQ_MULTI', points: 3,
        prompt: 'Which of the following are falsy values in JavaScript? (select all that apply)',
        options: [
            { text: '0',          isCorrect: true  },
            { text: '""',         isCorrect: true  },
            { text: 'null',       isCorrect: true  },
            { text: '[]',         isCorrect: false },
            { text: 'undefined',  isCorrect: true  },
        ],
    },
    {
        type: 'SHORT_TEXT', points: 2,
        prompt: 'What method converts a JSON string into a JavaScript object?',
        expectedAnswer: 'JSON.parse',
        caseSensitive: false,
    },
    {
        type: 'MCQ_SINGLE', points: 2,
        prompt: 'Which array method returns a new array with only elements that pass the test?',
        options: [
            { text: 'map()',    isCorrect: false },
            { text: 'filter()', isCorrect: true  },
            { text: 'reduce()', isCorrect: false },
            { text: 'forEach()', isCorrect: false },
        ],
    },
    {
        type: 'TRUE_FALSE', points: 1,
        prompt: '`===` checks both value and type in JavaScript.',
        options: [
            { text: 'True',  isCorrect: true  },
            { text: 'False', isCorrect: false },
        ],
    },
    {
        type: 'CODE', points: 5,
        prompt: `Write a JavaScript function \`reverseString(str)\` that takes a string and returns it reversed.\n\nExample:\n  reverseString("hello") → "olleh"`,
    },
    {
        type: 'ESSAY', points: 4,
        prompt: 'Explain the difference between `Promise` and `async/await` in JavaScript. When would you prefer one over the other?',
    },
];

const SQL_QUESTIONS = [
    {
        type: 'MCQ_SINGLE', points: 2,
        prompt: 'Which SQL statement is used to retrieve data from a database?',
        options: [
            { text: 'INSERT', isCorrect: false },
            { text: 'UPDATE', isCorrect: false },
            { text: 'SELECT', isCorrect: true  },
            { text: 'DELETE', isCorrect: false },
        ],
    },
    {
        type: 'TRUE_FALSE', points: 1,
        prompt: 'A PRIMARY KEY can contain NULL values.',
        options: [
            { text: 'True',  isCorrect: false },
            { text: 'False', isCorrect: true  },
        ],
    },
    {
        type: 'MCQ_SINGLE', points: 2,
        prompt: 'Which JOIN returns all rows from the left table even when there is no match in the right table?',
        options: [
            { text: 'INNER JOIN',  isCorrect: false },
            { text: 'RIGHT JOIN',  isCorrect: false },
            { text: 'LEFT JOIN',   isCorrect: true  },
            { text: 'CROSS JOIN',  isCorrect: false },
        ],
    },
    {
        type: 'SHORT_TEXT', points: 2,
        prompt: 'Which SQL clause is used to filter groups returned by GROUP BY?',
        expectedAnswer: 'HAVING',
        caseSensitive: false,
    },
    {
        type: 'MCQ_MULTI', points: 3,
        prompt: 'Which of these are valid SQL aggregate functions? (select all that apply)',
        options: [
            { text: 'COUNT()', isCorrect: true  },
            { text: 'SUM()',   isCorrect: true  },
            { text: 'TRIM()',  isCorrect: false },
            { text: 'AVG()',   isCorrect: true  },
            { text: 'SPLIT()', isCorrect: false },
        ],
    },
    {
        type: 'MCQ_SINGLE', points: 2,
        prompt: 'What does the `DISTINCT` keyword do in a SELECT statement?',
        options: [
            { text: 'Sorts the results',                     isCorrect: false },
            { text: 'Removes duplicate rows from the result', isCorrect: true  },
            { text: 'Limits the number of rows returned',    isCorrect: false },
            { text: 'Filters NULL values',                   isCorrect: false },
        ],
    },
    {
        type: 'CODE', points: 5,
        prompt: `Given a table \`orders\` with columns: id, customer_id, amount, created_at\n\nWrite a SQL query that returns the top 5 customers by total amount spent, showing customer_id and total_spent, ordered from highest to lowest.`,
    },
    {
        type: 'ESSAY', points: 3,
        prompt: 'Explain the difference between WHERE and HAVING clauses in SQL. Provide an example for each.',
    },
];

const PYTHON_QUESTIONS = [
    {
        type: 'MCQ_SINGLE', points: 2,
        prompt: 'What is the output of `type([])` in Python?',
        options: [
            { text: "<class 'array'>",  isCorrect: false },
            { text: "<class 'list'>",   isCorrect: true  },
            { text: "<class 'tuple'>",  isCorrect: false },
            { text: "<class 'dict'>",   isCorrect: false },
        ],
    },
    {
        type: 'TRUE_FALSE', points: 1,
        prompt: 'Python lists are immutable.',
        options: [
            { text: 'True',  isCorrect: false },
            { text: 'False', isCorrect: true  },
        ],
    },
    {
        type: 'MCQ_SINGLE', points: 2,
        prompt: 'Which Python keyword is used to handle exceptions?',
        options: [
            { text: 'catch',  isCorrect: false },
            { text: 'except', isCorrect: true  },
            { text: 'error',  isCorrect: false },
            { text: 'handle', isCorrect: false },
        ],
    },
    {
        type: 'SHORT_TEXT', points: 2,
        prompt: 'What built-in Python function returns the number of items in a list?',
        expectedAnswer: 'len',
        caseSensitive: false,
    },
    {
        type: 'MCQ_MULTI', points: 3,
        prompt: 'Which of the following are valid Python data structures? (select all that apply)',
        options: [
            { text: 'list',   isCorrect: true  },
            { text: 'dict',   isCorrect: true  },
            { text: 'array',  isCorrect: false },
            { text: 'tuple',  isCorrect: true  },
            { text: 'set',    isCorrect: true  },
        ],
    },
    {
        type: 'CODE', points: 5,
        prompt: `Write a Python function \`flatten(lst)\` that flattens a nested list of any depth into a single flat list.\n\nExample:\n  flatten([1, [2, [3, 4]], 5]) → [1, 2, 3, 4, 5]`,
    },
    {
        type: 'ESSAY', points: 4,
        prompt: 'Explain the difference between a Python list and a tuple. When would you choose one over the other? Include examples.',
    },
];

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('\n=== Seed: IT Tests ===\n');

    // 1. users
    console.log('── Users ──────────────────────────────────────────');
    const admin = await userModel.findOne({ role: ROLES.ADMIN });
    if (!admin) { console.error('No admin found — run the server once first to create the admin user.'); process.exit(1); }
    console.log(`  [ok] using admin: ${admin.email}`);

    const hr = await findOrCreateUser({
        email: 'hr@screening.local', firstName: 'Sarah', lastName: 'Connor', role: ROLES.HR,
    });
    const reviewer = await findOrCreateUser({
        email: 'reviewer@screening.local', firstName: 'John', lastName: 'Doe', role: ROLES.REVIEWER,
    });
    const candidate = await findOrCreateUser({
        email: 'candidate@screening.local', firstName: 'Alex', lastName: 'Smith', role: ROLES.CANDIDATE,
    });

    // 2. tests + questions
    console.log('\n── Tests & Questions ───────────────────────────────');
    const jsTest = await findOrCreateTest({ title: 'JavaScript Fundamentals', createdBy: hr._id });
    await addQuestions(jsTest, JS_QUESTIONS);

    const sqlTest = await findOrCreateTest({ title: 'SQL & Databases', createdBy: hr._id });
    await addQuestions(sqlTest, SQL_QUESTIONS);

    const pyTest = await findOrCreateTest({ title: 'Python Basics', createdBy: hr._id });
    await addQuestions(pyTest, PYTHON_QUESTIONS);

    // 3. offer
    console.log('\n── Offer ───────────────────────────────────────────');
    let offer = await offerModel.findOne({ title: 'Junior Full-Stack Developer' });
    if (offer) {
        console.log('  [skip] offer "Junior Full-Stack Developer" already exists');
    } else {
        offer = await offerModel.create({
            title: 'Junior Full-Stack Developer',
            description: 'We are looking for a junior full-stack developer to join our engineering team. You will work on web applications using JavaScript, Python, and SQL.',
            location: 'Tunis, Tunisia',
            workMode: 'HYBRID',
            type: 'FULL_TIME',
            requiredSkills: ['JavaScript', 'Python', 'SQL', 'React', 'Node.js'],
            salaryMin: 1500,
            salaryMax: 2500,
            currency: 'TND',
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            status: OFFER_STATUSES.OPEN,
            testIds: [jsTest._id, sqlTest._id, pyTest._id],
            createdBy: hr._id,
        });
        console.log('  [+] created offer "Junior Full-Stack Developer" with 3 tests linked');
    }

    // 4. session (attach all 3 tests)
    console.log('\n── Session ─────────────────────────────────────────');
    let session = await sessionModel.findOne({ offerId: offer._id });
    if (session) {
        console.log('  [skip] session already exists for this offer');
    } else {
        const now = new Date();
        session = await sessionModel.create({
            offerId: offer._id,
            startAt: new Date(now.getTime() - 60 * 60 * 1000),          // started 1h ago
            endAt:   new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // ends in 7 days
            instructions: 'Read each question carefully. You have 30 minutes per test. Code questions are evaluated manually by a reviewer. Good luck!',
            randomizeQuestions: true,
            tabSwitchLimit: 5,
            preventCopyPaste: false,
            requireFullscreen: false,
            allowedAttempts: 2,
            createdBy: hr._id,
        });
        console.log('  [+] created session (active now → +7 days, 2 attempts allowed)');
    }

    // 5. application for candidate
    console.log('\n── Application ─────────────────────────────────────');
    const existingApp = await applicationModel.findOne({ offerId: offer._id, candidateId: candidate._id });
    if (existingApp) {
        console.log('  [skip] candidate already has an application for this offer');
    } else {
        await applicationModel.create({
            offerId: offer._id,
            candidateId: candidate._id,
            status: APPLICATION_STATUSES.INVITED,
            coverNote: 'I am very excited about this opportunity and believe my skills in JavaScript and Python make me a great fit.',
        });
        console.log('  [+] created application (status: INVITED — ready to take the test)');
    }

    // ─── summary ───────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  SEED COMPLETE — login credentials (password: Test@12345)');
    console.log('═══════════════════════════════════════════════════');
    console.log('  HR        → hr@screening.local');
    console.log('  Reviewer  → reviewer@screening.local');
    console.log('  Candidate → candidate@screening.local');
    console.log('');
    console.log('  Tests created:');
    console.log('    • JavaScript Fundamentals  (9 questions, MCQ + Code + Essay)');
    console.log('    • SQL & Databases          (8 questions, MCQ + Code + Essay)');
    console.log('    • Python Basics            (7 questions, MCQ + Code + Essay)');
    console.log('');
    console.log('  Offer: "Junior Full-Stack Developer" (OPEN)');
    console.log('  Session: active now, expires in 7 days, 2 attempts allowed');
    console.log('  Candidate has an INVITED application → can take the test immediately');
    console.log('═══════════════════════════════════════════════════\n');

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
