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
    "retellingPrompt": "Retell the main argument in 80–150 words. Include the conclusion and use at least two target expressions naturally.",
    "referencePoints": [
      "The speakers introduce the main question.",
      "They explain the key cause with an example.",
      "They state the practical conclusion."
    ]
  }
}
```

Prefer 4–8 objective questions and 3–6 target expressions. Questions should test meaning,
collocation, context and paraphrase rather than easy factual recall. Include accepted spelling or
contraction variants in `answers`; frontend and backend comparison ignores case, repeated spaces,
curly apostrophe variants and terminal punctuation.
