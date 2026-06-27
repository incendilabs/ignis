# Ignis.Validation

Structural FHIR profile validation: validates a resource against a profile and returns an
`OperationOutcome`. Built on the Firely SDK validation engine
([`Firely.Fhir.Validation`](https://github.com/FirelyTeam/firely-validator-api)).

> [!NOTE]
> Early exploration. The shape will change.

## Concurrency

The Firely validator and its cached resolvers are not thread-safe, so `ProfileValidationService`
serializes validation behind a lock — safe to register as a singleton. Throughput is therefore
single-threaded; a pool of validators is the optimization if that becomes a bottleneck.
