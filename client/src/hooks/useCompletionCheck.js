import { useMemo } from 'react';
import { LENS_PROMPTS } from '../components/audit/lensConstants';

/**
 * useCompletionCheck - Computes whether an audit can be completed (AC-08).
 *
 * @param {Object|null} audit
 * @param {Object} responses
 * @param {string} activeLens
 * @param {Array} sessionTechniques
 *
 * @returns {{ canComplete: boolean, completionReason: string, answeredPrompts: number, hasAnyResponse: boolean }}
 */
export function useCompletionCheck(audit, responses, activeLens, sessionTechniques) {
  const answeredPrompts = useMemo(() => {
    const template = audit?.templateQuestions;
    const customPrompts = template?.lenses?.[activeLens]?.prompts;
    const prompts = (Array.isArray(customPrompts) && customPrompts.length > 0)
      ? customPrompts
      : (LENS_PROMPTS[activeLens] || []);
    return prompts.filter((_, i) => (responses[`lens-${activeLens}-${i}`] || '').trim().length >= 10).length;
  }, [activeLens, responses, audit?.templateQuestions]);

  const hasAnyResponse = useMemo(() => {
    return Object.values(responses || {}).some((v) => {
      if (v == null) return false;
      if (typeof v === 'string') return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return true;
    });
  }, [responses]);

  const canComplete = (sessionTechniques.length >= 1 || answeredPrompts >= 2) && hasAnyResponse;

  const completionReason = useMemo(() => {
    if (canComplete) return '';
    if (!hasAnyResponse && sessionTechniques.length === 0) {
      return 'Add a response or save a technique to complete this session.';
    }
    if (sessionTechniques.length < 1 && answeredPrompts < 2) {
      return `Answer at least 2 prompts or save a technique (${answeredPrompts}/2 prompts, ${sessionTechniques.length} technique${sessionTechniques.length === 1 ? '' : 's'}).`;
    }
    return 'Complete requirements not yet met.';
  }, [canComplete, hasAnyResponse, sessionTechniques.length, answeredPrompts]);

  return { canComplete, completionReason, answeredPrompts, hasAnyResponse };
}
