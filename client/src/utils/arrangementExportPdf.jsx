/**
 * Phase 1.4: arrangement PDF export.
 *
 * Mirrors the design of Phase 1.3's audit PDF (client/src/pdf/AuditReport.jsx)
 * but for the arrangement timeline. Uses @react-pdf/renderer (already a
 * dep) and lives in a .jsx file because it returns React elements.
 *
 * The PDF is text-based (not a baked image) so the output is selectable,
 * searchable, and screen-reader friendly. The visual PNG export is
 * handled by arrangementExport.js via the Canvas API.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1f', backgroundColor: '#ffffff' },
  h1: { fontSize: 18, marginBottom: 4, fontWeight: 'bold' },
  h2: { fontSize: 13, marginTop: 14, marginBottom: 6, fontWeight: 'bold', color: '#0c0c0e', borderBottom: '1pt solid #d4d4d8', paddingBottom: 2 },
  meta: { fontSize: 9, color: '#52525b', marginBottom: 14 },
  table: { display: 'flex', flexDirection: 'column', marginTop: 4 },
  row: { flexDirection: 'row', borderBottom: '0.5pt solid #e4e4e7', paddingVertical: 3 },
  rowHead: { flexDirection: 'row', backgroundColor: '#f4f4f5', paddingVertical: 4, fontWeight: 'bold' },
  cell: { flex: 1, fontSize: 9 },
  cellNarrow: { width: 60, fontSize: 9 },
  cellLabel: { width: 90, fontSize: 9 },
  swatch: { width: 8, height: 8, marginRight: 4, borderRadius: 2 },
  swatchRow: { flexDirection: 'row', alignItems: 'center' },
  empty: { fontSize: 9, color: '#71717a', fontStyle: 'italic', marginTop: 2 },
});

const pad2 = (n) => String(n).padStart(2, '0');
const formatTime = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
};

const Swatch = ({ color }) => (
  <View style={styles.swatchRow}>
    <View style={{ ...styles.swatch, backgroundColor: color || '#9ca3af' }} />
    <Text>{/* spacer */ ' '}</Text>
  </View>
);

const SectionRows = ({ sections = [] }) => {
  if (sections.length === 0) {
    return <Text style={styles.empty}>No sections recorded.</Text>;
  }
  return (
    <View style={styles.table}>
      <View style={styles.rowHead}>
        <View style={styles.cellNarrow}><Text>Start</Text></View>
        <View style={styles.cellNarrow}><Text>Length</Text></View>
        <View style={styles.cell}><Text>Name · Type</Text></View>
        <View style={styles.cell}><Text>Notes</Text></View>
      </View>
      {sections
        .slice()
        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
        .map((s, i) => (
          <View key={s.id || i} style={styles.row} wrap={false}>
            <View style={styles.cellNarrow}><Text>{formatTime(s.startTime)}</Text></View>
            <View style={styles.cellNarrow}><Text>{formatTime(s.duration)}</Text></View>
            <View style={styles.cell}>
              <Text>{s.name || '—'}{s.type ? ` · ${s.type}` : ''}</Text>
            </View>
            <View style={styles.cell}><Text>{s.notes || ''}</Text></View>
          </View>
        ))}
    </View>
  );
};

const TrackRows = ({ tracks = [] }) => {
  if (tracks.length === 0) {
    return <Text style={styles.empty}>No instrument tracks.</Text>;
  }
  return (
    <View>
      {tracks.map((t, ti) => (
        <View key={t.id || ti} wrap={false} style={{ marginTop: 6 }}>
          <View style={styles.rowHead}>
            <View style={styles.swatchRow}>
              <Swatch color={t.color} />
              <Text style={{ fontWeight: 'bold', fontSize: 10 }}>{t.name || t.category || 'Track'}</Text>
            </View>
          </View>
          {(t.blocks || []).length === 0 ? (
            <Text style={styles.empty}>No blocks in this track.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.rowHead}>
                <View style={styles.cellNarrow}><Text>Start</Text></View>
                <View style={styles.cellNarrow}><Text>Length</Text></View>
                <View style={styles.cell}><Text>Note</Text></View>
              </View>
              {t.blocks.map((b, bi) => (
                <View key={b.id || bi} style={styles.row} wrap={false}>
                  <View style={styles.cellNarrow}><Text>{formatTime(b.startTime)}</Text></View>
                  <View style={styles.cellNarrow}><Text>{formatTime(b.duration)}</Text></View>
                  <View style={styles.cell}><Text>{b.notes || ''}</Text></View>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

export const ArrangementReport = ({ song, sections = [], tracks = [], bpm, timeSignature, viewMode, generatedAt }) => {
  const stamp = (generatedAt instanceof Date ? generatedAt : new Date()).toISOString();
  return (
    <Document
      title={`Arrangement — ${song?.title || song?.name || 'Untitled'}`}
      author="Arra"
      subject="Song arrangement timeline"
    >
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.h1}>{song?.title || song?.name || 'Untitled arrangement'}</Text>
        <Text style={styles.meta}>
          {[
            song?.artist,
            bpm ? `${bpm} BPM` : null,
            timeSignature || null,
            viewMode ? `${viewMode} view` : null,
            `Generated ${stamp}`,
          ].filter(Boolean).join(' · ')}
        </Text>

        <Text style={styles.h2}>Sections</Text>
        <SectionRows sections={sections} />

        <Text style={styles.h2}>Instrument tracks</Text>
        <TrackRows tracks={tracks} />
      </Page>
    </Document>
  );
};

