// AuditReport — Bitwig-themed PDF report for a completed audit.
// Dynamic-imported by ExportPdfButton; do not import at module top-level
// (the @react-pdf/renderer + pdfkit CJS internals are ~700KB).

import React from 'react';
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer';

import {
  COLORS, SPACING, RADII, PAGE, TYPE, LENS_LABELS, LENS_DESCRIPTIONS, getActiveBrand,
} from './theme.js';
import { formatTimestamp, formatDuration } from '../utils/pdfData.js';

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.surface0,
    color: COLORS.text,
    paddingTop: PAGE.paddingTop,
    paddingBottom: PAGE.paddingBottom,
    paddingHorizontal: PAGE.paddingHorizontal,
    fontFamily: 'Barlow',
  },
  // Cover
  cover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: SPACING.xxl,
  },
  coverKicker: {
    ...TYPE.monoSmall,
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: SPACING.md,
  },
  coverTitle: {
    ...TYPE.display,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  coverArtist: {
    ...TYPE.h1,
    color: COLORS.textMuted,
    marginBottom: SPACING.xl,
  },
  coverDivider: {
    width: 60,
    height: 2,
    backgroundColor: COLORS.accent,
    marginBottom: SPACING.xl,
  },
  coverMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipLabel: {
    ...TYPE.monoSmall,
    color: COLORS.textDim,
    textTransform: 'uppercase',
    marginRight: 6,
  },
  chipValue: {
    ...TYPE.mono,
    color: COLORS.text,
  },
  chipAccent: {
    backgroundColor: COLORS.surface2,
    borderColor: COLORS.accent,
  },
  chipAccentValue: {
    ...TYPE.mono,
    color: COLORS.accent,
  },
  coverAudit: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    width: '100%',
  },
  coverAuditLabel: {
    ...TYPE.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
  },
  coverAuditTitle: {
    ...TYPE.h2,
    color: COLORS.text,
  },
  coverFooter: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: PAGE.paddingHorizontal,
    right: PAGE.paddingHorizontal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coverFooterText: {
    ...TYPE.monoSmall,
    color: COLORS.textDim,
  },
  // Section header (running header on body pages)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionHeaderKicker: {
    ...TYPE.monoSmall,
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginRight: SPACING.sm,
  },
  sectionHeaderTitle: {
    ...TYPE.h1,
    color: COLORS.text,
  },
  // Lens Q&A
  lensBlock: {
    marginBottom: SPACING.xl,
  },
  lensHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  lensBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    backgroundColor: COLORS.accent,
    color: COLORS.surface0,
    fontFamily: 'RobotoMono',
    fontSize: 8.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginRight: SPACING.sm,
  },
  lensName: {
    ...TYPE.h2,
    color: COLORS.text,
  },
  lensEmpty: {
    ...TYPE.monoSmall,
    color: COLORS.textDim,
    marginLeft: SPACING.sm,
  },
  lensDescription: {
    ...TYPE.bodySmall,
    color: COLORS.textDim,
    marginBottom: SPACING.md,
  },
  qaItem: {
    marginBottom: SPACING.md,
    paddingLeft: SPACING.md,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.surface3,
  },
  qaQuestion: {
    ...TYPE.bodySmall,
    color: COLORS.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  qaAnswer: {
    ...TYPE.body,
    color: COLORS.text,
  },
  qaTimestamp: {
    ...TYPE.monoSmall,
    color: COLORS.cyan,
    marginTop: 2,
  },
  qaEmpty: {
    ...TYPE.bodySmall,
    color: COLORS.textDim,
  },
  // Bookmarks
  bmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bmTime: {
    ...TYPE.mono,
    color: COLORS.accent,
    width: 60,
  },
  bmBody: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  bmLabel: {
    ...TYPE.body,
    color: COLORS.text,
    fontFamily: 'BarlowBold',
    marginBottom: 2,
  },
  bmNote: {
    ...TYPE.bodySmall,
    color: COLORS.textMuted,
  },
  bmLens: {
    ...TYPE.monoSmall,
    color: COLORS.cyan,
    textTransform: 'uppercase',
    width: 80,
    textAlign: 'right',
  },
  // Techniques
  techCard: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.sm,
    marginBottom: SPACING.md,
  },
  techHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  techLens: {
    ...TYPE.monoSmall,
    color: COLORS.cyan,
    textTransform: 'uppercase',
  },
  techTime: {
    ...TYPE.monoSmall,
    color: COLORS.accent,
  },
  techDescription: {
    ...TYPE.body,
    color: COLORS.text,
    // Enable word-wrap so long descriptions flow into multiple lines within
    // the card width instead of overflowing off the page.
  },
  techDescriptionMuted: {
    ...TYPE.bodySmall,
    color: COLORS.textDim,
    fontStyle: 'italic',
  },
  emptyState: {
    ...TYPE.bodySmall,
    color: COLORS.textDim,
    paddingVertical: SPACING.md,
  },
  // Page footer
  pageFooter: {
    position: 'absolute',
    bottom: 24,
    left: PAGE.paddingHorizontal,
    right: PAGE.paddingHorizontal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  pageFooterText: {
    ...TYPE.monoSmall,
    color: COLORS.textDim,
  },
});

function CoverPage({ data }) {
  const { song, audit } = data;
  const audioChips = [];
  if (audioChips && song.audio.tempo != null) {
    audioChips.push({ label: 'BPM', value: String(Math.round(song.audio.tempo)) });
  }
  if (song.audio.key && song.audio.scale) {
    audioChips.push({ label: 'Key', value: `${song.audio.key} ${song.audio.scale}` });
  } else if (song.audio.key) {
    audioChips.push({ label: 'Key', value: song.audio.key });
  }
  if (song.audio.meter) {
    audioChips.push({ label: 'Meter', value: song.audio.meter });
  }
  if (song.duration) {
    audioChips.push({ label: 'Duration', value: song.duration });
  }
  if (song.year) {
    audioChips.push({ label: 'Year', value: String(song.year) });
  }

  return (
    <Page size={PAGE.size} style={styles.page}>
      <View style={styles.cover}>
        <Text style={styles.coverKicker}>{getActiveBrand().reportKicker}</Text>
        <Text style={styles.coverTitle}>{song.title}</Text>
        <Text style={styles.coverArtist}>{song.artist}</Text>
        <View style={styles.coverDivider} />
        {audioChips.length > 0 && (
          <View style={styles.coverMetaRow}>
            {audioChips.map((c) => (
              <View
                key={c.label}
                style={[styles.chip, c.label === 'BPM' || c.label === 'Key' ? styles.chipAccent : null]}
              >
                <Text style={styles.chipLabel}>{c.label}</Text>
                <Text style={c.label === 'BPM' || c.label === 'Key' ? styles.chipAccentValue : styles.chipValue}>
                  {c.value}
                </Text>
              </View>
            ))}
          </View>
        )}
        {audit.lensSelection.length > 0 && (
          <View style={styles.coverMetaRow}>
            {audit.lensSelection.map((lens) => (
              <View key={lens} style={styles.chip}>
                <Text style={styles.chipLabel}>Lens</Text>
                <Text style={styles.chipValue}>{LENS_LABELS[lens] || lens}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.coverAudit}>
          <Text style={styles.coverAuditLabel}>Audit</Text>
          <Text style={styles.coverAuditTitle}>{audit.title || `${song.title} — Arra Audit`}</Text>
          {audit.completedAt && (
            <Text style={styles.coverFooterText}>
              Completed {new Date(audit.completedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.coverFooter} fixed>
        <Text style={styles.coverFooterText}>{getActiveBrand().footerLabel}</Text>
        <Text
          style={styles.coverFooterText}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
        />
        <Text style={styles.coverFooterText}>
          {new Date().toLocaleDateString()}
        </Text>
      </View>
    </Page>
  );
}

function LensPages({ data }) {
  const { lensResponses, audit } = data;
  // Always include every selected lens, even with zero responses, so the
  // reader sees which lenses were considered in this audit. Empty lenses
  // render an "0 questions answered" note inside their block.
  const lenses = audit.lensSelection;
  if (lenses.length === 0) {
    return (
      <Page size={PAGE.size} style={styles.page}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderKicker}>02</Text>
          <Text style={styles.sectionHeaderTitle}>Lens Analysis</Text>
        </View>
        <Text style={styles.emptyState}>
          No lens responses captured for this audit.
        </Text>
        <PageFooter pageNumber={2} totalPages={null} />
      </Page>
    );
  }

  // Chunk lenses into pages (max 2 lens blocks per page)
  const pages = [];
  for (let i = 0; i < lenses.length; i += 2) {
    pages.push(lenses.slice(i, i + 2));
  }

  return pages.map((pageLenses, pageIdx) => {
    const pageNumber = 2 + pageIdx;
    return (
      <Page key={`lens-page-${pageIdx}`} size={PAGE.size} style={styles.page} wrap>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderKicker}>02</Text>
          <Text style={styles.sectionHeaderTitle}>Lens Analysis</Text>
        </View>
        {pageLenses.map((lens) => {
          const entries = lensResponses[lens] || [];
          return (
            <View key={lens} style={styles.lensBlock} wrap>
              <View style={styles.lensHeading}>
                <Text style={styles.lensBadge}>{LENS_LABELS[lens] || lens}</Text>
                <Text style={styles.lensName}>· {LENS_LABELS[lens] || lens}</Text>
                <Text style={styles.lensEmpty}>
                  · {entries.length === 0 ? '0 questions answered' : `${entries.length} response${entries.length === 1 ? '' : 's'}`}
                </Text>
              </View>
              <Text style={styles.lensDescription}>{LENS_DESCRIPTIONS[lens] || ''}</Text>
              {entries.length === 0 ? (
                <Text style={styles.qaEmpty}>
                  No responses were captured for this lens.
                </Text>
              ) : (
                entries.map((entry, idx) => (
                  <View key={`${lens}-${idx}`} style={styles.qaItem} wrap={false}>
                    {entry.question ? <Text style={styles.qaQuestion}>{entry.question}</Text> : null}
                    {entry.answer ? <Text style={styles.qaAnswer}>{entry.answer}</Text> : null}
                    {entry.timestamp != null && (
                      <Text style={styles.qaTimestamp}>▸ {formatTimestamp(entry.timestamp)}</Text>
                    )}
                    {entry.note ? <Text style={styles.qaAnswer}>{entry.note}</Text> : null}
                  </View>
                ))
              )}
            </View>
          );
        })}
        <PageFooter pageNumber={pageNumber} totalPages={null} />
      </Page>
    );
  });
}

function BookmarksPage({ data }) {
  const { bookmarks } = data;
  return (
    <Page size={PAGE.size} style={styles.page}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderKicker}>03</Text>
        <Text style={styles.sectionHeaderTitle}>Session Bookmarks</Text>
      </View>
      {bookmarks.length === 0 ? (
        <Text style={styles.emptyState}>No bookmarks were captured.</Text>
      ) : (
        bookmarks.map((bm, idx) => (
          <View key={bm.id || idx} style={styles.bmRow} wrap={false}>
            <Text style={styles.bmTime}>{formatTimestamp(bm.timestampSeconds)}</Text>
            <View style={styles.bmBody}>
              {bm.label ? <Text style={styles.bmLabel}>{bm.label}</Text> : null}
              {bm.note ? <Text style={styles.bmNote}>{bm.note}</Text> : null}
              {!bm.label && !bm.note ? <Text style={styles.bmNote}>(no note)</Text> : null}
            </View>
            {bm.lens ? <Text style={styles.bmLens}>{LENS_LABELS[bm.lens] || bm.lens}</Text> : null}
          </View>
        ))
      )}
      <PageFooter pageNumber={null} totalPages={null} />
    </Page>
  );
}

function TechniquesPage({ data }) {
  const { techniques } = data;
  return (
    <Page size={PAGE.size} style={styles.page}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderKicker}>04</Text>
        <Text style={styles.sectionHeaderTitle}>Captured Techniques</Text>
      </View>
      {techniques.length === 0 ? (
        <Text style={styles.emptyState}>No techniques were captured.</Text>
      ) : (
        techniques.map((t, idx) => {
          const desc = t.description || '';
          return (
            <View key={t.id || idx} style={styles.techCard} wrap>
              <View style={styles.techHeader}>
                <Text style={styles.techLens}>
                  {t.lens ? (LENS_LABELS[t.lens] || t.lens) : '—'}
                </Text>
                {t.exampleTimestamp != null && (
                  <Text style={styles.techTime}>▸ {formatTimestamp(t.exampleTimestamp)}</Text>
                )}
              </View>
              <Text style={styles.techDescription}>{desc}</Text>
            </View>
          );
        })
      )}
      <PageFooter pageNumber={null} totalPages={null} />
    </Page>
  );
}

function PageFooter({ pageNumber, totalPages }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.pageFooterText}>{getActiveBrand().reportKicker}</Text>
      <Text
        style={styles.pageFooterText}
        render={({ pageNumber: pn, totalPages: tp }) =>
          pageNumber ? `Page ${pageNumber} · ${pn}/${tp}` : `${pn} / ${tp}`
        }
      />
    </View>
  );
}

export default function AuditReport({ data }) {
  return (
    <Document
      title={`Arra Audit — ${data.song.title} — ${data.song.artist}`}
      author="Arra"
      subject="Music production audit"
    >
      <CoverPage data={data} />
      <LensPages data={data} />
      <BookmarksPage data={data} />
      <TechniquesPage data={data} />
    </Document>
  );
}
