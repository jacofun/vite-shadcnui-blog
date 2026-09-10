# Daily assessment payload

Add an `assessment` object to each daily lesson job. The sync workflow validates it and copies it
into the published episode `metadata.json`. Older episodes may omit the object; their page still
offers AI retelling feedback without objective questions.

```json
{
  "assessment": {
    "schemaVersion": 1,
    "targetExpressions": [
      {
        "expression": "rule of thumb",
        "meaning": "实用但并非绝对准确的经验法则",
        "usage": "Use it when giving a practical general guideline."
      }
    ],
    "objectiveQuestions": [
      {
        "id": "choice-1",
        "type": "single-choice",
        "prompt": "Which sentence uses the expression naturally?",
        "targetExpression": "rule of thumb",
        "options": [
          { "id": "a", "text": "As a rule of thumb, allow ten minutes for setup." },
          { "id": "b", "text": "The rule of my thumb feels cold." }
        ],
        "answer": "a",
        "explanation": "The expression introduces a useful general guideline."
      },
      {
        "id": "fill-1",
        "type": "fill-blank",
        "prompt": "Complete the phrase: as a ___",
        "targetExpression": "rule of thumb",
        "answers": ["rule of thumb"],
        "explanation": "The complete fixed phrase is 'as a rule of thumb'."
      }
    ],
    "subjectiveQuestions": [
      {
        "id": "guided-recall-1",
        "type": "comprehension",
        "prompt": "In 10–25 words, give the reason stated in the episode. Use ‘rule of thumb’. Start with: One reason is that…",
        "targetExpression": "rule of thumb",
        "gradingCriteria": "First check that the answer gives the stated reason, then check that rule of thumb is used naturally. Accept simple, accurate English and identify no more than two useful improvements."
      },
      {
        "id": "guided-comprehension-1",
        "type": "comprehension",
        "prompt": "In 20–40 words, explain the contrast in your own words. Use ‘rule of thumb’. You may use: in general / however.",
        "targetExpression": "rule of thumb",
        "gradingCriteria": "Check the contrast first, then the natural use of rule of thumb. Do not require advanced vocabulary; distinguish a missing idea from wording that is merely less idiomatic."
      },
      {
        "id": "paraphrase-1",
        "type": "paraphrase",
        "prompt": "In 20–40 words, rewrite the supplied idea with the same meaning and use ‘rule of thumb’ naturally.",
        "targetExpression": "rule of thumb",
        "gradingCriteria": "Check that the original meaning is preserved and rule of thumb is used naturally. Accept straightforward English and identify no more than two useful improvements."
      },
      {
        "id": "supported-application-1",
        "type": "application",
        "prompt": "In 30–60 words, respond to the stated work scenario. Choose one phrase from this bank: rule of thumb / [another target expression].",
        "targetExpression": "rule of thumb",
        "gradingCriteria": "Check that the response fits the bounded scenario and that one phrase-bank expression is natural. Accept a simple, relevant answer and identify no more than two useful improvements."
      },
      {
        "id": "bounded-response-1",
        "type": "application",
        "prompt": "In 40–70 words, give your view on the episode topic and naturally use at least one target expression.",
        "targetExpression": "rule of thumb",
        "gradingCriteria": "Check that the answer addresses the episode topic and uses at least one target expression naturally. Do not reward complexity for its own sake; identify no more than two useful improvements."
      }
    ],
    "retellingPrompt": "Without looking at the transcript, retell the episode in 80–120 words. Follow these prompts: topic → two key ideas or reasons → conclusion or example. Choose at least two of these target expressions and use them naturally: rule of thumb / [expression 2] / [expression 3].",
    "referencePoints": [
      "The speakers introduce the main question.",
      "They explain the key cause with an example.",
      "They state the practical conclusion."
    ]
  }
}
```

Prefer 8 objective questions and about 6 target expressions. Meanings and usage notes must be in
English. Questions should test meaning,
collocation, context and paraphrase rather than easy factual recall. Include accepted spelling or
contraction variants in `answers`; frontend and backend comparison ignores case, repeated spaces,
curly apostrophe variants and terminal punctuation.

Prefer exactly five subjective questions, submitted and graded independently out of 10. Keep the
existing schema and use this ordered progression:

1. Guided recall: `type: "comprehension"`, one transcript-supported sentence, 10–25 words, with a
   required target expression and a sentence starter when useful.
2. Guided comprehension: `type: "comprehension"`, explain one reason, contrast or view in 20–40
   words, with a required target expression and one or two optional chunks.
3. Paraphrase: `type: "paraphrase"`, preserve a supplied meaning in 20–40 words while actively
   using the required target expression.
4. Supported application: `type: "application"`, answer a bounded work, study or daily-life
   scenario in 30–60 words and choose one expression from a two- or three-item phrase bank.
5. Bounded free response: `type: "application"`, give a short view within the episode topic in
   40–70 words and use at least one target expression.

Reuse expressions already practised in the objective section. Every `gradingCriteria` must tell the
grader to check whether the question was answered, assess the required expression, accept simple but
correct English without demanding advanced vocabulary, distinguish missing meaning from merely less
idiomatic wording, and give only one or two high-value improvements. If a better expression is useful,
offer at most one alternative supported by the transcript or `targetExpressions`.

Older assessment payloads may contain three questions or omit `subjectiveQuestions`; the application
supports both and derives three compatible fallback questions when the field is absent.
