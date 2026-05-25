import React, { useState, useEffect } from 'react';
import { useAudio } from '../context/AudioContext';

const TYPE_COLORS = {
  intro: '#fbbf24',       // amber
  verse: '#34d399',       // emerald
  chorus: '#a78bfa',      // violet
  bridge: '#fb7185',      // rose
  outro: '#9ca3af',       // gray
  'pre-chorus': '#22d3ee', // cyan
  solo: '#f97316',        // orange
  custom: '#f472b6'       // pink
};

const ArrangementTimelineWidget = ({ responses, onChange, song, readOnly = false }) => {
  const { loadSong, activeSong, play, seekTo, currentTime } = useAudio();
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  // Parse blocks array from responses
  const rawTimeline = responses['arrangement-timeline'];
  let blocks = [];
  try {
    blocks = typeof rawTimeline === 'string' 
      ? JSON.parse(rawTimeline) 
      : (rawTimeline || []);
  } catch (err) {
    console.error('Failed to parse arrangement timeline:', err);
  }

  // Ensure blocks are sorted by start time
  const sortedBlocks = [...blocks].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  const totalDuration = song?.durationSeconds || sortedBlocks.reduce((acc, curr) => acc + (parseInt(curr.duration) || 0), 0) || 120;

  const selectedBlock = sortedBlocks.find(b => b.id === selectedBlockId);

  // Helper formats
  const formatTime = (seconds) => {
    const s = Math.floor(seconds || 0);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseTime = (str) => {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const parts = str.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10) || 0;
      const seconds = parseInt(parts[1], 10) || 0;
      return minutes * 60 + seconds;
    }
    return parseInt(str, 10) || 0;
  };

  const saveBlocks = (newBlocks) => {
    onChange('arrangement-timeline', JSON.stringify(newBlocks));
  };

  const addBlock = () => {
    const lastBlock = sortedBlocks[sortedBlocks.length - 1];
    const newStart = lastBlock 
      ? (lastBlock.startTime || 0) + (lastBlock.duration || 30) 
      : 0;

    const newBlock = {
      id: 'block-' + Date.now() + Math.random().toString(36).substr(2, 5),
      name: 'New Section',
      type: 'verse',
      startTime: newStart,
      duration: 30,
      notes: ''
    };

    const newBlocks = [...blocks, newBlock];
    saveBlocks(newBlocks);
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (blockId, fields) => {
    const newBlocks = blocks.map(b => {
      if (b.id === blockId) {
        return { ...b, ...fields };
      }
      return b;
    });
    saveBlocks(newBlocks);
  };

  const deleteBlock = (blockId) => {
    const newBlocks = blocks.filter(b => b.id !== blockId);
    saveBlocks(newBlocks);
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const moveBlock = (index, direction) => {
    if (direction === 'left' && index === 0) return;
    if (direction === 'right' && index === sortedBlocks.length - 1) return;

    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    const itemA = sortedBlocks[index];
    const itemB = sortedBlocks[targetIndex];

    // Swap start times to exchange positions in timeline sorting
    const tempStart = itemA.startTime;
    itemA.startTime = itemB.startTime;
    itemB.startTime = tempStart;

    saveBlocks([...blocks]);
  };

  const handleSeek = (seconds) => {
    const sId = song?._id;
    if (!sId) return;

    if (activeSong && activeSong._id === sId) {
      seekTo(seconds);
      play();
    } else {
      loadSong(song);
      setTimeout(() => {
        seekTo(seconds);
        play();
      }, 800);
    }
  };

  // Compute active block based on player's currentTime
  const activeBlock = sortedBlocks.find((b, idx) => {
    const start = b.startTime || 0;
    const end = start + (b.duration || 0);
    return currentTime >= start && currentTime < end;
  });

  return (
    <div style={{ marginBottom: '25px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '11px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.45)' }}>
          🎵 Arrangement Timeline Map {sortedBlocks.length > 0 && `(${formatTime(totalDuration)} total)`}
        </h3>
        {!readOnly && (
          <button 
            type="button" 
            onClick={addBlock}
            style={{ padding: '3px 8px', fontSize: '9px', background: 'rgba(208, 143, 96, 0.1)', color: '#d08f60', borderColor: 'rgba(208, 143, 96, 0.3)' }}
          >
            + Add Section
          </button>
        )}
      </div>

      {/* Timeline view */}
      {sortedBlocks.length === 0 ? (
        <div style={{
          padding: '30px 15px',
          textAlign: 'center',
          background: '#0c0c0e',
          border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: '2px',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '11px',
          fontStyle: 'italic'
        }}>
          No arrangement sections defined. Click "+ Add Section" to map out the song structure.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* Visual Track container */}
          <div 
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '75px',
              background: '#070709',
              borderRadius: '2px',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              padding: '4px',
              gap: '4px',
              overflowX: 'auto',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
              alignItems: 'stretch'
            }}
          >
            {sortedBlocks.map((block, idx) => {
              const duration = block.duration || 30;
              const widthPct = (duration / totalDuration) * 100;
              const isSelected = block.id === selectedBlockId;
              const isCurrent = activeBlock && activeBlock.id === block.id;
              const color = TYPE_COLORS[block.type] || TYPE_COLORS.custom;

              return (
                <div
                  key={block.id}
                  onClick={() => {
                    if (!readOnly) {
                      setSelectedBlockId(isSelected ? null : block.id);
                    } else {
                      handleSeek(block.startTime || 0);
                    }
                  }}
                  style={{
                    flex: `0 0 max(110px, ${widthPct}%)`,
                    background: isSelected ? 'rgba(255, 255, 255, 0.04)' : '#111114',
                    border: `1px solid ${isSelected ? '#d08f60' : 'rgba(255,255,255,0.05)'}`,
                    borderLeft: `4px solid ${color}`,
                    borderRadius: '2px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    boxShadow: isCurrent ? `0 0 10px ${color}30` : 'none',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  title={block.notes ? `Notes: ${block.notes}` : `Click to ${readOnly ? 'seek' : 'edit'}`}
                >
                  {/* Play/Active Indicator */}
                  {isCurrent && (
                    <div style={{
                      position: 'absolute',
                      right: '4px',
                      top: '4px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 8px ${color}`
                    }} />
                  )}

                  {/* Section Label */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'rgba(255,255,255,0.9)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {block.name}
                      </span>
                    </div>
                    {block.notes && (
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {block.notes}
                      </span>
                    )}
                  </div>

                  {/* Times Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: color }}>
                      {formatTime(block.startTime)}
                    </span>
                    <span style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
                      {block.duration}s
                    </span>
                  </div>

                  {/* Move buttons in Edit Mode (absolute at bottom to keep it usable) */}
                  {!readOnly && isSelected && (
                    <div 
                      style={{ 
                        position: 'absolute', 
                        bottom: '2px', 
                        right: '2px', 
                        display: 'flex', 
                        gap: '2px',
                        background: '#151518',
                        padding: '1px',
                        borderRadius: '1px',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }} 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveBlock(idx, 'left')}
                        style={{ padding: '0px 4px', fontSize: '8px', border: 'none', background: 'transparent' }}
                        title="Move Left"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        disabled={idx === sortedBlocks.length - 1}
                        onClick={() => moveBlock(idx, 'right')}
                        style={{ padding: '0px 4px', fontSize: '8px', border: 'none', background: 'transparent' }}
                        title="Move Right"
                      >
                        ▶
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Playhead visualization cursor (red vertical line) */}
            {activeSong && song?._id === activeSong._id && currentTime > 0 && currentTime <= totalDuration && (
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${(currentTime / totalDuration) * 100}%`,
                  width: '2px',
                  background: '#f43f5e',
                  boxShadow: '0 0 6px #f43f5e',
                  pointerEvents: 'none',
                  zIndex: 10,
                  transition: 'left 0.4s linear'
                }}
              />
            )}
          </div>

          {/* Edit Drawer / Panel */}
          {!readOnly && selectedBlock && (
            <div 
              style={{
                background: '#111114',
                border: '1px solid rgba(255,255,255,0.06)',
                borderLeft: `4px solid ${TYPE_COLORS[selectedBlock.type] || TYPE_COLORS.custom}`,
                borderRadius: '2px',
                padding: '15px',
                marginTop: '5px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <strong style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#d08f60', textTransform: 'uppercase' }}>
                  🔧 Edit Section: {selectedBlock.name}
                </strong>
                <button
                  type="button"
                  onClick={() => deleteBlock(selectedBlock.id)}
                  className="danger"
                  style={{ padding: '2px 8px', fontSize: '9px', border: 'none' }}
                >
                  Delete Section
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                {/* Title */}
                <div className="form-group">
                  <label>Section Title</label>
                  <input
                    type="text"
                    value={selectedBlock.name}
                    onChange={(e) => updateBlock(selectedBlock.id, { name: e.target.value })}
                    placeholder="e.g. Chorus 1, Intro"
                  />
                </div>

                {/* Preset Type */}
                <div className="form-group">
                  <label>Type / Color</label>
                  <select
                    value={selectedBlock.type}
                    onChange={(e) => updateBlock(selectedBlock.id, { type: e.target.value })}
                  >
                    <option value="intro">Intro (Yellow)</option>
                    <option value="verse">Verse (Green)</option>
                    <option value="pre-chorus">Pre-Chorus (Cyan)</option>
                    <option value="chorus">Chorus (Violet)</option>
                    <option value="bridge">Bridge (Rose)</option>
                    <option value="solo">Solo (Orange)</option>
                    <option value="outro">Outro (Gray)</option>
                    <option value="custom">Custom (Pink)</option>
                  </select>
                </div>

                {/* Start Time */}
                <div className="form-group">
                  <label>Start Time (seconds or mm:ss)</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="text"
                      value={formatTime(selectedBlock.startTime)}
                      onChange={(e) => updateBlock(selectedBlock.id, { startTime: parseTime(e.target.value) })}
                      placeholder="e.g. 1:15"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => updateBlock(selectedBlock.id, { startTime: Math.floor(currentTime) })}
                      style={{ padding: '6px', fontSize: '9px' }}
                      title="Sync with current playback time"
                    >
                      🎯 Sync
                    </button>
                  </div>
                </div>

                {/* Duration */}
                <div className="form-group">
                  <label>Duration (seconds)</label>
                  <input
                    type="number"
                    value={selectedBlock.duration}
                    onChange={(e) => updateBlock(selectedBlock.id, { duration: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 30"
                  />
                </div>

                {/* Notes (spans full width) */}
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Section Production Cues / Observations</label>
                  <input
                    type="text"
                    value={selectedBlock.notes || ''}
                    onChange={(e) => updateBlock(selectedBlock.id, { notes: e.target.value })}
                    placeholder="e.g. Synth pad fades, drum machine starts, main vocal enters..."
                  />
                </div>
              </div>

              {/* Utility actions */}
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => handleSeek(selectedBlock.startTime || 0)}
                  style={{ padding: '4px 10px', fontSize: '10px' }}
                >
                  ▶ Play Section
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelectedBlockId(null)}
                  style={{ padding: '4px 10px', fontSize: '10px' }}
                >
                  Close Editor
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArrangementTimelineWidget;
