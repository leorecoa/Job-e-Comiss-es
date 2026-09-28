# Team invitations

The commercial app links a barber user to a professional only through explicit
invitation acceptance. Administrative service_role/database access is separate.

The owner uses Management > Team to issue an invitation for an active professional
and recipient email, then shares `/convite#token=...`. The recipient authenticates
as barber, confirms the email and explicitly accepts. `accept_team_invitation`
validates the invitation and updates the canonical profile atomically. The UI
reloads that profile before entering the barber dashboard.

Issue, copy/share, reissue and revoke remain available. Tokens stay in memory;
never log or persist invitation URLs/tokens. The database stores only token hashes.
Direct authenticated profile mutations remain forbidden.

## Retirement rollout

Migration 034 retires the old unilateral email-linking function. Migrations
001-033 remain historical and immutable. Do not replay individual historical
function definitions over the current schema.

Deploy the frontend without the legacy action first; apply the reviewed 034
migration separately under the normal manual database rollout. Existing linked
profiles are unchanged. Old cached bundles fail closed if they call the retired
endpoint. Do not roll back to a frontend that requires it or silently restore the
unilateral linking function; prefer a forward fix preserving explicit acceptance.

Validate owner invitation management, recipient acceptance/profile refresh,
tenant isolation, profile write denial and absence of the retired RPC. Keep the
independent invitation concurrency scenarios. No migration is applied remotely
by the application or by this document.
