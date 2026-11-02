# lib/fhir

FHIR logic for Ignis.Web as plain TypeScript over FHIR JSON, with no React or UI dependencies.

Functions start with a verb: `get…` computes from its arguments, `fetch…` calls the network, `find…` may return nothing, `is…` and `has…` return booleans, `resolve…` follows references, and `xToY` converts structures.
