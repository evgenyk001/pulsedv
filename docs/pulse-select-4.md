# PULSE Select 4.0 architecture

PULSE Select is a live request composer, not a separate data island.

## Runtime data flow

1. **PULSE Control** edits `PulseState.select` and `PulseState.mortgagePrograms`.
2. Control saves through `PUT /api/v1/control/state`.
3. The Mini App reads the public configuration through `GET /api/v1/public/state`.
4. PULSE Select loads matching-ready published properties from the catalog API using `view=match`.
5. Matching runs in the shared `packages/domain/propertyMatch.ts` domain layer.
6. Mortgage affordability is delegated to `packages/domain/mortgagePolicy.ts`.
7. The standalone Mortgage page uses the same mortgage policy module and writes the user's configured scenario to local storage.
8. PULSE Select can reuse that scenario without duplicating the regulated mortgage rules.

## Configuration ownership

PULSE Control owns:
- cities;
- room options;
- supplemental delivery options;
- whether mortgage mode is enabled;
- whether Smart Input is enabled;
- whether What-if scenarios are enabled;
- enabled personal preferences and their maximum count;
- ranking weights;
- editable mortgage program terms such as minimum down payment, maximum term, total limit, and editable program rates;
- separate market-rate baselines for newbuilds, secondary homes, and house/IHС scenarios.

The Family Mortgage child-count scale is versioned policy code (`MORTGAGE_POLICY_VERSION`) rather than a misleading single editable rate/limit. Control displays that scale as policy-managed.

## Catalog ownership

Production PULSE Select never needs galleries or PDFs to rank properties. It reads the lightweight catalog match view through:
- `GET /api/v1/public/catalog`

The selection hook supports up to the production catalog limit in paged match-ready batches.

## Mortgage consistency

The Mortgage screen and PULSE Select both call:
- `calculateMortgageScenario(...)`

Select does not maintain its own copy of:
- annuity formulas;
- subsidized/market split;
- program limits;
- Family Mortgage child scale;
- Family 50% down-payment rule;
- IT secondary restriction;
- Far East increased-limit behavior.

If a precise mortgage scenario has not been configured, Select uses a conservative policy scenario and labels bank/program eligibility as requiring confirmation.

## Privacy-safe analytics

On `select_submit`, the Mini App records the existing request facts needed by Control and Interest DNA plus:
- `source: "pulse-select-v4"`;
- `policyVersion`;
- the first three exact `propertyIds` shown by Select.

Personal eligibility inputs such as child count or disability status are not added to analytics metadata.

For a mortgage request, Interest DNA mirrors those exact submitted property IDs instead of trying to reconstruct the regulated mortgage scenario from incomplete analytics data. For a cash request it may safely recompute recommendations from non-sensitive request facts.

The backend metadata sanitizer explicitly permits a bounded list of property IDs and still drops unknown/private metadata.

## Resume compatibility

The existing storage key `pulse_selection_current_v2` is kept to avoid breaking older installs and the Home resume card.

Select 4.0 writes:
- `version: 4`;
- `started`;
- `showResult`;
- the request parameters.

`ContinueChoice` understands both the legacy step-based state and the new live-composer state.
