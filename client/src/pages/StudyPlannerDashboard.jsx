import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';

// Lens styling helper
const getLensStyle = (lens) => {
  switch (lens?.toLowerCase()) {
    case 'harmony':
      return { background: 'rgba(124, 58, 237, 0.15)', color: '#c084fc', border: '1px solid rgba(124, 58, 237, 0.3)' };
    case 'rhythm':
      return { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' };
    case 'texture':
      return { background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)' };
    case 'form':
      return { background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)' };
    case 'arrangement':
      return { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' };
    default:
      return { background: '#282828', color: '#8a8a8a', border: '1px solid #383838' };
  }
};

const StudyPlannerDashboard = () => {
  const backend = useBackend();
  const navigate = useNavigate();

  const [activeProgress, setActiveProgress] = useState(null);
  const [curricula, setCurricula] = useState([]);
  const [techniques, setTechniques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AI Modal & Draft states
  const [showAIModal, setShowAIModal] = useState(false);
  const [focusArea, setFocusArea] = useState('lofi drum groove patterns');
  const [selectedTechIds, setSelectedTechIds] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [draftPlan, setDraftPlan] = useState(null);

  // Weekly review form states
  const [reviewsInput, setReviewsInput] = useState({}); // { [weekNumber]: { changedInEars, notUnderstood, nextInvestigationQuestion } }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [progressRes, curriculaRes, techniquesRes] = await Promise.all([
        backend.getActiveStudyProgress(),
        backend.getCurricula(),
        backend.getTechniques()
      ]);
      setActiveProgress(progressRes);
      setCurricula(curriculaRes || []);
      setTechniques(techniquesRes?.techniques || []);

      // Initialize reviewsInput based on existing weekly reviews
      if (progressRes?.weeklyReviews) {
        const initInput = {};
        progressRes.weeklyReviews.forEach((review) => {
          initInput[review.weekNumber] = {
            changedInEars: review.changedInEars || '',
            notUnderstood: review.notUnderstood || '',
            nextInvestigationQuestion: review.nextInvestigationQuestion || ''
          };
        });
        setReviewsInput(initInput);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load study plan data.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCourse = async (curriculumId) => {
    try {
      setError('');
      let targetId = curriculumId;
      if (!targetId) {
        // Find seeded plan in list, or try seeding it
        const seeded = curricula.find(c => c.slug === '2-week-song-audit-planner');
        if (seeded) {
          targetId = seeded._id;
        } else {
          try {
            // Seed via direct axios post if we have api wrapper
            const seedRes = await backend.api?.post('/curricula/seed');
            targetId = seedRes?.data?.curriculum?._id;
          } catch (e) {
            console.error('Seeding route error', e);
          }
        }
      }

      // If still no ID (in memory fallback)
      if (!targetId) {
        targetId = 'curriculum-seeded-2-week';
      }

      const progress = await backend.startCurriculum(targetId);
      setActiveProgress(progress);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to start study plan.');
    }
  };

  const handleToggleTechCheckbox = (techId) => {
    setSelectedTechIds((prev) =>
      prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId]
    );
  };

  const handleGenerateAIPlan = async (e) => {
    e.preventDefault();
    if (!focusArea.trim()) {
      setError('Please provide a focus area.');
      return;
    }
    try {
      setGenerating(true);
      setError('');
      // Find selected technique names/details to pass
      const pastTechniques = techniques.filter((t) => selectedTechIds.includes(t._id));
      const plan = await backend.generateAICurriculum(focusArea, pastTechniques);
      setDraftPlan(plan);
      setShowAIModal(false);
    } catch (err) {
      setError(err.message || 'Failed to generate AI plan.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDraftFieldChange = (field, val) => {
    setDraftPlan((prev) => ({
      ...prev,
      [field]: val
    }));
  };

  const handleDraftDayChange = (index, field, val) => {
    setDraftPlan((prev) => {
      const newDays = [...prev.days];
      newDays[index] = {
        ...newDays[index],
        [field]: val
      };
      return {
        ...prev,
        days: newDays
      };
    });
  };

  const handleActivateDraftPlan = async () => {
    try {
      setError('');
      if (!draftPlan) return;
      const saved = await backend.saveCustomCurriculum(draftPlan);
      const progress = await backend.startCurriculum(saved._id);
      setDraftPlan(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to activate custom plan.');
    }
  };

  const handleReviewInputChange = (weekNumber, field, val) => {
    setReviewsInput((prev) => ({
      ...prev,
      [weekNumber]: {
        ...prev[weekNumber],
        [field]: val
      }
    }));
  };

  const handleSubmitReview = async (weekNumber) => {
    try {
      setError('');
      const reviewData = reviewsInput[weekNumber] || {};
      if (!reviewData.changedInEars?.trim() || !reviewData.notUnderstood?.trim()) {
        setError('Please answer all questions before submitting your reflection.');
        return;
      }
      await backend.submitWeeklyReview(activeProgress._id, weekNumber, reviewData);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to submit review.');
    }
  };

  if (loading) {
    return <div className="loading" style={{ color: 'var(--accent-orange)' }}>Loading Study Planner...</div>;
  }

  // Find seeded curriculum
  const seededCurriculum = curricula.find(c => c.slug === '2-week-song-audit-planner') || curricula[0] || {
    title: '2-Week Song Audit Planner',
    description: 'A structured 14-day study plan focusing on harmony, bass movement, texture, and form to guide your listening and application practice.'
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Header Panel */}
      <div className="panel" style={{ background: 'var(--bg-panel)', borderBottom: '2px solid #ff6600', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h1 style={{ margin: 0, border: 'none', padding: 0 }}>📅 Study Planner Dashboard</h1>
          {!activeProgress && !draftPlan && (
            <button 
              onClick={() => setShowAIModal(true)}
              style={{ background: '#ff6600', color: '#0c0c0e', fontWeight: 'bold' }}
            >
              ✨ AI Plan Generator
            </button>
          )}
        </div>
        <p className="card-subtitle" style={{ margin: 0 }}>
          {activeProgress ? `ACTIVE STUDY PLAN // ${activeProgress.curriculumId.title}` : 'No active study plan.'}
        </p>
        {error && <div className="error" style={{ marginTop: '10px' }}>{error}</div>}
      </div>

      {/* CASE 1: Active Progress Dashboard */}
      {activeProgress && (
        <div>
          {/* Progress Bar Widget */}
          {(() => {
            const completedCount = activeProgress.dayProgress.filter(dp => dp.status === 'completed').length;
            const totalCount = activeProgress.dayProgress.length;
            const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            return (
              <div className="panel" style={{ background: '#18181b', padding: '15px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontFamily: 'Roboto Mono', fontSize: '12px', color: '#ff6600', fontWeight: 'bold' }}>
                    CURRICULUM PROGRESS
                  </span>
                  <span style={{ fontFamily: 'Roboto Mono', fontSize: '12px', color: '#ffffff' }}>
                    {completedCount} / {totalCount} DAYS COMPLETED ({percent}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#282828', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${percent}%`, height: '100%', background: '#ff6600', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            );
          })()}

          {/* Group days by Week */}
          {(() => {
            const durationWeeks = activeProgress.curriculumId.durationWeeks || 2;
            const weeksArray = [];
            for (let w = 1; w <= durationWeeks; w++) {
              const weekDays = activeProgress.dayProgress.filter(
                dp => dp.dayNumber >= (w - 1) * 7 + 1 && dp.dayNumber <= w * 7
              );
              weeksArray.push({ weekNumber: w, days: weekDays });
            }

            return weeksArray.map(({ weekNumber, days }) => {
              const weekCompleted = days.every(dp => dp.status === 'completed');
              const review = activeProgress.weeklyReviews?.find(r => r.weekNumber === weekNumber);
              const reviewCompleted = review?.completedAt != null;

              return (
                <div key={weekNumber} style={{ marginBottom: '30px' }}>
                  <h2 style={{ fontSize: '1.2rem', color: '#ff6600', borderBottom: '1px solid #383838', paddingBottom: '6px', marginBottom: '15px' }}>
                    WEEK {weekNumber}
                  </h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                    {days.map((dp) => {
                      const dayMeta = activeProgress.curriculumId.days.find(d => d.dayNumber === dp.dayNumber) || {};
                      const isActive = dp.status === 'active' || dp.dayNumber === activeProgress.currentDay;
                      const isCompleted = dp.status === 'completed';
                      const isLocked = !isCompleted && !isActive;

                      return (
                        <div 
                          key={dp.dayNumber} 
                          className="panel" 
                          style={{ 
                            background: isLocked ? '#141416' : '#1e1e24', 
                            borderColor: isActive ? '#ff6600' : '#383838',
                            opacity: isLocked ? 0.5 : 1,
                            padding: '15px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontFamily: 'Roboto Mono', fontSize: '13px', fontWeight: 'bold', color: '#ff6600' }}>
                                DAY {dp.dayNumber}
                              </span>
                              <span className="badge" style={{ ...getLensStyle(dayMeta.lens), textTransform: 'uppercase' }}>
                                {dayMeta.lens}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>
                                {dayMeta.songTitle} - <span style={{ color: '#8a8a8a' }}>{dayMeta.artistName}</span>
                              </span>
                            </div>

                            <div>
                              {isCompleted && (
                                <span className="badge success" style={{ textTransform: 'uppercase' }}>
                                  ✓ Completed
                                </span>
                              )}
                              {isActive && (
                                <Link to={`/planner/session/${dp.dayNumber}`}>
                                  <button style={{ background: '#ff6600', color: '#000000', fontWeight: 'bold' }}>
                                    {dp.responses && Object.keys(dp.responses).length > 0 ? 'Resume Session' : 'Start Session'}
                                  </button>
                                </Link>
                              )}
                              {isLocked && (
                                <span className="badge" style={{ textTransform: 'uppercase' }}>
                                  🔒 Locked
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Show prompt snippet */}
                          {!isLocked && (
                            <div style={{ marginTop: '10px', fontSize: '11px', color: '#8a8a8a' }}>
                              <strong>Focus:</strong> {dayMeta.listeningPrompt}
                            </div>
                          )}

                          {/* Completed days summaries */}
                          {isCompleted && dp.responses && (
                            <div style={{ marginTop: '12px', padding: '10px', background: '#141416', border: '1px solid #282828', borderRadius: '2px' }}>
                              <div style={{ fontFamily: 'Roboto Mono', fontSize: '10px', color: '#ff6600', marginBottom: '8px' }}>
                                AUDIT RESPONSE SUMMARY:
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {Object.entries(dp.responses).map(([key, val]) => (
                                  <div key={key} style={{ fontSize: '11px' }}>
                                    <span style={{ color: '#8a8a8a', textTransform: 'capitalize' }}>
                                      {key.replace(/_/g, ' ')}:
                                    </span>{' '}
                                    <span style={{ color: '#ffffff' }}>{val}</span>
                                  </div>
                                ))}
                              </div>
                              {dp.auditId && (
                                <div style={{ marginTop: '10px' }}>
                                  <Link to={`/audit/${dp.auditId}`} style={{ fontSize: '11px', fontWeight: 'bold', textDecoration: 'underline' }}>
                                    → View Full Audit Log
                                  </Link>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Weekly Review Segment */}
                  {weekCompleted && (
                    <div className="panel" style={{ background: '#1d1916', borderColor: '#e65c00', padding: '20px' }}>
                      <h3 style={{ color: '#ff6600', marginBottom: '12px', fontSize: '12px', fontFamily: 'Roboto Mono' }}>
                        📋 WEEK {weekNumber} REFLECTION & HANDOFF
                      </h3>

                      {reviewCompleted ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ borderLeft: '2px solid #ff6600', paddingLeft: '10px' }}>
                            <div style={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'Roboto Mono' }}>WHAT CHANGED IN YOUR EAR:</div>
                            <p style={{ fontSize: '12px', color: '#ffffff', margin: 0 }}>{review.changedInEars}</p>
                          </div>
                          <div style={{ borderLeft: '2px solid #ff6600', paddingLeft: '10px' }}>
                            <div style={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'Roboto Mono' }}>WHAT IS STILL CONFUSING:</div>
                            <p style={{ fontSize: '12px', color: '#ffffff', margin: 0 }}>{review.notUnderstood}</p>
                          </div>
                          <div style={{ borderLeft: '2px solid #ff6600', paddingLeft: '10px' }}>
                            <div style={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'Roboto Mono' }}>NEXT INVESTIGATION QUESTION:</div>
                            <p style={{ fontSize: '12px', color: '#ffffff', margin: 0 }}>{review.nextInvestigationQuestion}</p>
                          </div>
                          <span className="badge success" style={{ alignSelf: 'flex-start', marginTop: '5px' }}>
                            🔒 Review Locked & Saved
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          <p style={{ fontSize: '11px', color: '#8a8a8a', margin: 0 }}>
                            All day logs for this week are completed. Please submit your reflection to synthesize techniques.
                          </p>

                          <div className="form-group">
                            <label>What changed in your ear this week?</label>
                            <textarea
                              placeholder="Describe how your analytical hearing shifted..."
                              value={reviewsInput[weekNumber]?.changedInEars || ''}
                              onChange={(e) => handleReviewInputChange(weekNumber, 'changedInEars', e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label>What concepts are still confusing or need more runtime?</label>
                            <textarea
                              placeholder="Be honest about what didn't click..."
                              value={reviewsInput[weekNumber]?.notUnderstood || ''}
                              onChange={(e) => handleReviewInputChange(weekNumber, 'notUnderstood', e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label>What is your next concrete investigation question?</label>
                            <textarea
                              placeholder="e.g. 'How do I layer kick sub-frequencies beneath organic bass?'"
                              value={reviewsInput[weekNumber]?.nextInvestigationQuestion || ''}
                              onChange={(e) => handleReviewInputChange(weekNumber, 'nextInvestigationQuestion', e.target.value)}
                            />
                          </div>

                          <button 
                            onClick={() => handleSubmitReview(weekNumber)}
                            style={{ background: '#ff6600', color: '#000000', fontWeight: 'bold', alignSelf: 'flex-start' }}
                          >
                            Submit Weekly Review
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* CASE 2: Draft AI Plan Preview Editor */}
      {!activeProgress && draftPlan && (
        <div className="panel" style={{ background: 'var(--bg-panel)', padding: '20px' }}>
          <h2 style={{ color: '#ff6600', marginBottom: '15px' }}>📝 INTERACTIVE PLAN BUILDER (AI DRAFT)</h2>
          <p style={{ fontSize: '12px', color: '#8a8a8a', marginBottom: '20px' }}>
            Review, edit, and fine-tune the AI generated prompts and recommendations before activating this plan.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
            <div className="form-group">
              <label>Curriculum Title</label>
              <input
                type="text"
                value={draftPlan.title || ''}
                onChange={(e) => handleDraftFieldChange('title', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Curriculum Description</label>
              <textarea
                value={draftPlan.description || ''}
                onChange={(e) => handleDraftFieldChange('description', e.target.value)}
              />
            </div>
          </div>

          <h3 style={{ fontSize: '11px', color: '#ff6600', marginBottom: '10px', fontFamily: 'Roboto Mono' }}>
            DAILY PROGRAMMING PREVIEW
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
            {draftPlan.days?.map((day, idx) => (
              <div 
                key={day.dayNumber} 
                className="panel" 
                style={{ background: '#1e1e24', border: '1px solid #383838', padding: '15px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontFamily: 'Roboto Mono', fontSize: '12px', fontWeight: 'bold', color: '#ff6600' }}>
                    DAY {day.dayNumber}
                  </span>
                  <span className="badge" style={getLensStyle(day.lens)}>
                    {day.lens}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div className="form-group">
                    <label>Target Song Title</label>
                    <input
                      type="text"
                      value={day.songTitle || ''}
                      onChange={(e) => handleDraftDayChange(idx, 'songTitle', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Target Artist Name</label>
                    <input
                      type="text"
                      value={day.artistName || ''}
                      onChange={(e) => handleDraftDayChange(idx, 'artistName', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label>YouTube Search Recommendation / Query</label>
                  <input
                    type="text"
                    value={day.songQuery || ''}
                    onChange={(e) => handleDraftDayChange(idx, 'songQuery', e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label>Listening Prompt</label>
                  <textarea
                    value={day.listeningPrompt || ''}
                    onChange={(e) => handleDraftDayChange(idx, 'listeningPrompt', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>DAW Application Prompt</label>
                  <textarea
                    value={day.applicationPrompt || ''}
                    onChange={(e) => handleDraftDayChange(idx, 'applicationPrompt', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleActivateDraftPlan}
              style={{ background: '#ff6600', color: '#000000', fontWeight: 'bold' }}
            >
              Activate Study Plan
            </button>
            <button 
              onClick={() => setDraftPlan(null)}
              className="secondary"
            >
              Discard Draft
            </button>
          </div>
        </div>
      )}

      {/* CASE 3: No Active Plan, Show Default Seeded Planner */}
      {!activeProgress && !draftPlan && (
        <div className="panel" style={{ background: 'var(--bg-panel)', padding: '25px', border: '1px solid #383838' }}>
          <h2 style={{ color: '#ffffff', marginBottom: '8px' }}>
            {seededCurriculum.title || '2-Week Song Audit Planner'}
          </h2>
          <p style={{ color: '#8a8a8a', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
            {seededCurriculum.description || 'A structured 14-day study plan focusing on harmony, bass movement, texture, and form to guide your listening and application practice.'}
          </p>

          {seededCurriculum.focusAreas && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '25px' }}>
              {seededCurriculum.focusAreas.map((area, idx) => (
                <span key={idx} className="badge primary" style={{ textTransform: 'uppercase' }}>
                  {area}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button 
              onClick={() => handleStartCourse(seededCurriculum._id)}
              style={{ background: '#ff6600', color: '#000000', fontWeight: 'bold', fontSize: '12px', padding: '8px 16px' }}
            >
              🚀 Start Course (Default Planner)
            </button>
            <button 
              onClick={() => setShowAIModal(true)}
              className="secondary"
              style={{ fontSize: '12px', padding: '8px 16px' }}
            >
              ✨ AI Custom Plan Generator
            </button>
          </div>
        </div>
      )}

      {/* AI Generator Modal */}
      {showAIModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="panel" style={{ 
            background: 'var(--bg-panel)', 
            border: '2px solid #ff6600', 
            width: '100%', 
            maxWidth: '550px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '25px'
          }}>
            <h3 style={{ color: '#ff6600', borderBottom: '1px solid #383838', paddingBottom: '6px', marginBottom: '15px' }}>
              ✨ AI STUDY PLAN GENERATOR
            </h3>

            {generating ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ fontSize: '20px', marginBottom: '10px' }}>🧠 Synthesizing Curriculum...</div>
                <div style={{ fontSize: '12px', color: '#8a8a8a' }}>Analyzing past techniques & composing daily study prompts.</div>
              </div>
            ) : (
              <form onSubmit={handleGenerateAIPlan}>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>What style, sub-genre, or technique is your primary focus?</label>
                  <input
                    type="text"
                    required
                    value={focusArea}
                    onChange={(e) => setFocusArea(e.target.value)}
                    placeholder="e.g. lofi drum groove patterns, psychedelic bass lines"
                  />
                  <small style={{ fontSize: '10px', color: '#8a8a8a', marginTop: '4px' }}>
                    The AI will build a 7-day study curriculum targeting this specific concept.
                  </small>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>
                    Optionally target past techniques from your Notebook:
                  </label>
                  {techniques.length === 0 ? (
                    <p style={{ fontSize: '11px', color: '#8a8a8a', fontStyle: 'italic' }}>
                      Your notebook is empty. Start audits to log techniques.
                    </p>
                  ) : (
                    <div style={{ 
                      maxHeight: '150px', 
                      overflowY: 'auto', 
                      background: '#111111', 
                      border: '1px solid #383838', 
                      padding: '8px', 
                      borderRadius: '2px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      {techniques.map((tech) => (
                        <label key={tech._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ffffff', textTransform: 'none', fontSize: '11px' }}>
                          <input
                            type="checkbox"
                            checked={selectedTechIds.includes(tech._id)}
                            onChange={() => handleToggleTechCheckbox(tech._id)}
                            style={{ width: 'auto' }}
                          />
                          <span>
                            [{tech.lens?.toUpperCase()}] {tech.techniqueName || tech.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '10px' }}>
                  <button type="submit" style={{ background: '#ff6600', color: '#000000', fontWeight: 'bold' }}>
                    Generate Plan
                  </button>
                  <button type="button" onClick={() => setShowAIModal(false)} className="secondary">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default StudyPlannerDashboard;
