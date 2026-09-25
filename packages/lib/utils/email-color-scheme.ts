/**
 * Mail apps that honour it (Apple Mail, iOS Mail, Outlook) keep the email in
 * its light design instead of auto-darkening it, so the brand button and text
 * colours are the ones the sender chose. Gmail's apps ignore the declaration
 * and recolour anyway, which is why brand logos carry their own light plate
 * (Operify composes it before provisioning a team).
 */
const LIGHT_ONLY_META =
  '<meta name="color-scheme" content="light only"/><meta name="supported-color-schemes" content="light only"/>';

export const declareLightColorScheme = (html: string, plainText?: boolean): string =>
  plainText || !/<head>/i.test(html) ? html : html.replace(/<head>/i, (head) => `${head}${LIGHT_ONLY_META}`);
