const OpenAI = require('openai');

let _client = null;
function getClient() {
    if (!_client) {
        _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _client;
}

/**
 * Generate questions for a given test using OpenAI.
 * @param {object} params
 * @param {string} params.topic - Topic or description for question generation
 * @param {number} params.count - Number of questions to generate
 * @param {string[]} params.types - Array of question types: MCQ_SINGLE, MCQ_MULTI, TRUE_FALSE, SHORT_ANSWER, LONG_ANSWER
 * @param {string} params.difficulty - easy | medium | hard
 * @returns {Promise<object[]>} Array of question objects ready to insert
 */
async function generateQuestions({ topic, count = 5, types = ['MCQ_SINGLE'], difficulty = 'medium' }) {
    const typesDesc = types.join(', ');

    const systemPrompt = `You are an expert technical assessor. Generate assessment questions for a screening platform.
Return ONLY a valid JSON array with no extra text. Each element must follow this schema:
{
  "type": "<MCQ_SINGLE|MCQ_MULTI|TRUE_FALSE|SHORT_ANSWER|LONG_ANSWER>",
  "text": "<question text>",
  "points": <integer 1-10>,
  "options": [{ "text": "<option>", "isCorrect": <bool> }],  // only for MCQ_SINGLE, MCQ_MULTI, TRUE_FALSE
  "expectedAnswer": "<string>",  // only for SHORT_ANSWER, LONG_ANSWER
  "timeLimit": <seconds integer, optional>
}
For MCQ_SINGLE: exactly 1 correct option, 3-4 total options.
For MCQ_MULTI: 1 or more correct options, 3-5 total options.
For TRUE_FALSE: exactly 2 options "True" and "False".
For SHORT_ANSWER/LONG_ANSWER: no options field, include expectedAnswer.`;

    const userPrompt = `Generate ${count} assessment question(s) on the topic: "${topic}".
Difficulty: ${difficulty}.
Use only these question type(s): ${typesDesc}.
Distribute evenly if multiple types are requested.`;

    const response = await getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
    });

    const raw = response.choices[0].message.content;
    const parsed = JSON.parse(raw);

    // Handle both { questions: [...] } and plain array responses
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions ?? Object.values(parsed)[0]);

    const typeMap = {
        SHORT_ANSWER: 'SHORT_TEXT',
        LONG_ANSWER: 'ESSAY',
    };

    return questions.map((question) => ({
        ...question,
        type: typeMap[question.type] || question.type,
    }));
}

module.exports = { generateQuestions };
