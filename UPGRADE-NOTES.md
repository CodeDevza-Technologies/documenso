# Upgrade notes

## Copy and translations

- Check the English catalogue (`packages/lib/translations/en/web.po`) after every upstream sync: if upstream rewords one of the sentences we override there, `lingui extract --clean` silently brings the vendor wording back.
