# Upgrade notes

## Copy and translations

- Check the English catalogue (`packages/lib/translations/en/web.po`) after every upstream sync: if upstream rewords one of the sentences we override there, `lingui extract --clean` silently brings the vendor wording back.

## Operating the Operify cell

- Keep branding off on the shared environment teams (the per-environment Operify teams that are not a tenant's). The recipient pages' tab title names a team only when that team's branding is on, so turning it on there would show the environment team's own name to clients.
