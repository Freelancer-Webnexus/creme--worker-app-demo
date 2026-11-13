# API contract

The mock in `mock/` implements this contract. The app's wire types are in `src/services/api/api-types.ts`. A change to this file needs sign-off from the backend developers (house rule 2).

Base URL: `http://localhost:4000` on the host, `http://10.0.2.2:4000` from the Android emulator.

Every `/me/*` request carries:

- `Authorization: Bearer <token>` from sign-in.
- `X-Worker-Id: <workerId>`. The token belongs to a phone number, and one number can map to several workers (M10). The server answers 403 when the worker is not on the token's number.

## Endpoints

| Endpoint | Request | Responses |
| --- | --- | --- |
| `POST /auth/otp/request` | `{ "phone": string }` | `200 {}` for any number, so the endpoint does not reveal which numbers exist |
| `POST /auth/otp/verify` | `{ "phone": string, "code": string }` | `200 OtpVerifyResponse`; `401 { "error": "bad_code" }` |
| `GET /me/assignment` | — | `200 Assignment`; `401 { "error": "session_expired" }` |
| `POST /me/terms-acceptances` | `{ "clientActionId": string, "termsVersionId": string }` | `201`; `200` replay of the same `clientActionId`; `409 { "error": "stale_terms", "currentTerms": TermsVersion }` |
| `POST /me/documents` | multipart: `clientActionId`, `documentType`, `image` | `201 { "state": "pending_review" }`; `200` replay; `413 { "error": "too_large" }`; `422 { "error": "unknown_document_type" }` |

Phone numbers are compared by digits only, so `+52 55 1000 0001` and `+525510000001` are the same number.

## Rules the server follows

- **Deduplication (M3).** The server keeps the response of every saved `clientActionId`. A request with a known id returns that response body with status `200` and saves nothing. The check runs before every other validation, so a replay never turns into a 409. The server keys the saved response by worker, route and `clientActionId`, so another worker, or the same id on another route, is a new action.
- **Stale terms (M6).** An acceptance whose `termsVersionId` is not the current version is rejected with 409 and the current version. Nothing is saved.
- **Size limit (M7).** An `image` part over 1.5 MB (1 572 864 bytes) is rejected with 413.
- **Catalog (M7).** A `documentType` outside the assignment's `requiredDocuments` is rejected with 422.
- **Resubmission (M8).** An upload for a document in `correction_requested` creates a new record and sets the state to `pending_review`.
- **Malformed requests.** A malformed body or a missing field answers `400 { "error": "bad_request" }`.
- **Unknown phone.** `POST /auth/otp/verify` with an unknown phone answers `401 { "error": "bad_code" }`, the same as a wrong code, so the endpoint does not reveal which numbers exist.
- **Missing token.** A missing or unknown token answers `401 { "error": "session_expired" }`.
- **Terms acceptance body.** The `201` body of `POST /me/terms-acceptances` is `{}`.
- **Sessions.** A token is valid for 24 hours or until `/__admin/expire-tokens`.

## Differences from the brief's starting shapes

| Change | Why |
| --- | --- |
| `X-Worker-Id` header | The brief does not say how the server knows which worker on a shared number is calling |
| `acceptedTermsVersionId` in the assignment | The app derives the terms state from server facts, also after a reinstall |
| `flags` in the assignment | Minimal stand-in for a remote feature-flag service (house rule 7) |
| Replay returns the original body | The app handles 201 and 200 with one code path |

## Failure switches

Initial values come from environment variables. The admin routes change them while the mock runs, because some scenarios need a switch flipped while the phone is offline and a restart would erase the deduplication records.

| Switch | Environment variable | Admin route |
| --- | --- | --- |
| Latency | `MOCK_LATENCY_MS=2000` | `POST /__admin/switches { "latencyMs": 2000 }` |
| Random 500s | `MOCK_ERROR_RATE=0.5` | `POST /__admin/switches { "errorRate": 0.5 }` |
| Drop the response after saving | `MOCK_DROP_RESPONSE=next` | `POST /__admin/switches { "dropResponse": "next" }` (`"always"`, `"off"`) |
| Image limit (default 1 572 864 bytes) | — | `POST /__admin/switches { "maxImageBytes": 1024 }` |
| Publish terms v3 | `MOCK_PUBLISH_V3=1` | `POST /__admin/publish-terms` |
| Expire every token | — | `POST /__admin/expire-tokens` |
| Inspect saved records | — | `GET /__admin/state` |
| Reset to the seed | — | `POST /__admin/reset` |

The drop switch arms only on `POST /me/terms-acceptances` and `POST /me/documents`: the server saves the action, then closes the socket without answering. Latency and random 500s apply to every route outside `/__admin`. A lower image limit makes any photo answer 413, so scenario 5 runs on a release build, where the app always compresses. A reset keeps sessions and clears records, deduplication and switches, and returns terms to v2.

## Seed

Job order `JO-2026-0142`: Valle Verde Farms, Yuma, AZ, season 2026-03-01 to 2026-07-31. Current terms v2. Required documents: `passport`, `ds160_confirmation`, `signed_contract`. One-time code: `123456`. All names and numbers are fictional (house rule 6).

| Phone | Worker | Starting state |
| --- | --- | --- |
| +52 55 1000 0001 | Ana López | v2 not confirmed; no documents |
| +52 55 1000 0002 | Bruno Díaz | v2 confirmed; passport approved |
| +52 55 1000 0002 | Carla Díaz | v2 not confirmed; passport correction requested: "Foto borrosa, vuelva a tomarla" |
