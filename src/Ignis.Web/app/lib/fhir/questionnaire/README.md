# Questionnaire

FHIR Questionnaire and QuestionnaireResponse logic as pure functions over plain FHIR JSON.

Main modules:

- **Questionnaire**: the model types, parsing, and the answer choices for an item.
- **Response**: functions on a QuestionnaireResponse, such as `createResponse`, `setAnswer`, `pruneEmptyItems` and `validateResponse`. They work without a UI, for example on a server.
- **Form**: a filling session. `FormState` holds the response and whether issues are shown. `reduceFormState(state, event)` returns the next state for a `FormEvent`, such as `setAnswer` or `check`, and returns the same object when nothing changes. `getFormNodes` gives the tree a form renders: the enabled items, each with its path, answer and issue.
