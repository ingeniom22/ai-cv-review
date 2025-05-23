import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { cors } from 'hono/cors';
import OpenAI from "openai";


const PROMPT = `Accept a chunk of text from a CV, review it, assign a grade based on relevance and clarity, and give critics.\
The chunk of text given is, of course not the whole CV, but a part of it. therefore missing informations are ok, just focus on the content
of the chunk given to you, assume that further information is provided in the rest of the CV.\
e.g. If the chunk of text given to you is the identity section, dont criticize for not having a work experience or detailed achievements and skills.\
dont penalize the grading for missing information, but focus on the content of the chunk given to you.\

ignore typos as it might be from OCR error and not user error.\
dont penalize the grading for typos, but focus on the content of the chunk given to you.\

dont penalize the grading for formatting issues, such as inconsistent spacing, punctuation errors, and some unclear phrasing

Analyze the given text to determine important aspects such as skills, experiences, achievements, and other relevant information, evaluate the text overall for clarity, conciseness, and relevance. Assign a score from 0 to 100.

# Steps

1. **Text Analysis**: Review the CV text to identify key skills, experiences, and achievements.
2. **Evaluation**: Assess the quality of the highlighted content based on its relevance and clarity.
3. **Scoring**: Assign a numerical score between 0 and 100 based on the evaluation.

# Output Format

Output a single JSON object in the following format:
'''json
{
  "grade": [Grade as a number],
    "critics": "[Detailed evaluation in the Original Language]"
}
`;

type Bindings = {
  OPENAI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();
app.use('*', cors({ origin: '*' }));


function hashString(str: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str))
    .then((hashBuffer) => {
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    });
}

const requestSchema = z.object({
  texts: z.array(z.string()),
});

app.post(
  '/grade',
  zValidator('json', requestSchema),
  async (c) => {
    const openai = new OpenAI({
      apiKey: c.env.OPENAI_API_KEY,
    });

    const { texts } = await c.req.json();

    const joinedTexts = texts.join(' ');
    const id = await hashString(joinedTexts);


    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          "role": "system",
          "content": [
            {
              "type": "input_text",
              "text": PROMPT
            }
          ]
        },
        {
          "role": "user",
          "content": [
            {
              "type": "input_text",
              "text": joinedTexts
            }
          ]
        },

      ],
      text: {
        "format": {
          "type": "json_schema",
          "name": "review",
          "strict": true,
          "schema": {
            "type": "object",
            "required": [
              "grade",
              "critics"
            ],
            "properties": {
              "grade": {
                "type": "number",
                "description": "A numerical evaluation given in the review."
              },
              "critics": {
                "type": "string",
                "description": "Comments or opinions from critics regarding the subject."
              }
            },
            "additionalProperties": false
          }
        }
      },
      reasoning: {},
      tools: [],
      temperature: 0.25,
      max_output_tokens: 512,
      top_p: 1,
      store: true
    });

    // parse string to json
    const jsonResponse = JSON.parse(response.output_text);

    const grade = jsonResponse.grade;
    const critics = jsonResponse.critics;

    // Dummy grading logic
    // const grade = 85;
    // const critics = 'Clear and well-structured, but consider reducing redundancy in a few places.';

    console.log('Received texts:', texts);

    return c.json({
      id,
      texts,
      grade,
      critics,
    });
  }
);

export default app;
