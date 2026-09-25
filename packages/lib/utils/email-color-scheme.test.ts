import { describe, expect, it } from 'vitest';

import { declareLightColorScheme } from './email-color-scheme';

describe('declareLightColorScheme', () => {
  it('adds the light-only colour scheme right after the opening head tag', () => {
    const html = '<!DOCTYPE html><html><head><style></style></head><body>x</body></html>';
    const out = declareLightColorScheme(html);
    expect(out).toContain('<head><meta name="color-scheme" content="light only"/>');
    expect(out).toContain('<meta name="supported-color-schemes" content="light only"/><style>');
    expect(out.match(/color-scheme/g)).toHaveLength(2);
  });

  it('leaves plain text and headless output alone', () => {
    expect(declareLightColorScheme('Hello', true)).toBe('Hello');
    expect(declareLightColorScheme('<p>no head</p>')).toBe('<p>no head</p>');
  });
});
