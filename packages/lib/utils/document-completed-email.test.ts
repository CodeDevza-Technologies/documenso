import { describe, expect, it } from 'vitest';

import { buildDocumentCompletedSubject, completedAttachmentName, stripPdfSuffix } from './document-completed-email';

describe('buildDocumentCompletedSubject', () => {
  it('names the team, the document and its reference, like the invite', () => {
    expect(
      buildDocumentCompletedSubject({
        teamName: 'Operify Demo',
        title: 'Cleaning Services Agreement',
        itemTitles: ['SIG-20260925-P24Y8.pdf'],
      }),
    ).toBe('Operify Demo: Cleaning Services Agreement signed (SIG-20260925-P24Y8)');
  });

  it('gives two documents with the same title different subjects', () => {
    const a = buildDocumentCompletedSubject({ teamName: 'Halcyon', title: 'Agreement', itemTitles: ['SIG-A.pdf'] });
    const b = buildDocumentCompletedSubject({ teamName: 'Halcyon', title: 'Agreement', itemTitles: ['SIG-B.pdf'] });
    expect(a).not.toBe(b);
  });

  it('leaves the reference out when it adds nothing', () => {
    expect(buildDocumentCompletedSubject({ teamName: 'T', title: 'Contract', itemTitles: ['Contract.pdf'] })).toBe(
      'T: Contract signed',
    );
    expect(buildDocumentCompletedSubject({ teamName: 'T', title: 'Pack', itemTitles: ['a.pdf', 'b.pdf'] })).toBe(
      'T: Pack signed',
    );
    expect(buildDocumentCompletedSubject({ teamName: '  ', title: ' Contract ', itemTitles: [] })).toBe(
      'Contract signed',
    );
    expect(buildDocumentCompletedSubject({ title: 'Contract', itemTitles: ['REF-1'] })).toBe('Contract signed (REF-1)');
  });
});

describe('completedAttachmentName', () => {
  it('ends in exactly one .pdf', () => {
    expect(completedAttachmentName('SIG-20260925-P24Y8.pdf')).toBe('SIG-20260925-P24Y8.pdf');
    expect(completedAttachmentName('SIG-20260925-P24Y8')).toBe('SIG-20260925-P24Y8.pdf');
    expect(completedAttachmentName('Report.PDF')).toBe('Report.pdf');
    expect(completedAttachmentName('  ')).toBe('document.pdf');
    expect(stripPdfSuffix('a.pdf.pdf')).toBe('a.pdf');
  });
});
