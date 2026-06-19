import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseDeepLinkParams, DEEP_LINK_KEYS } from '../utils/deepLinks.js';

/**
 * useDeepLinkParams - reads audit deep-link query string.
 *
 *   const { timestampSeconds, bookmarkId } = useDeepLinkParams();
 *
 * Returns `null` for either field if not present in the URL.
 * Re-renders only when the relevant query keys change.
 */
export function useDeepLinkParams() {
  const [searchParams] = useSearchParams();
  return useMemo(() => {
    const search = searchParams.toString();
    return parseDeepLinkParams(search ? `?${search}` : '');
  }, [searchParams.get(DEEP_LINK_KEYS.TIMESTAMP_KEY), searchParams.get(DEEP_LINK_KEYS.BOOKMARK_KEY)]);
}

export default useDeepLinkParams;
