/**
 * ISearchService - Port (interface) for music research services
 * 
 * Any class implementing this interface must provide a way to search for
 * information about a song/artist. This allows production code to use real
 * APIs (Tavily, Perplexity) while tests use mock implementations.
 * 
 * Contract: searchSongInfo(title, artist) MUST return an object with
 * query, results, and summary fields.
 */

export class ISearchService {
  /**
   * Search for information about a song and artist
   * @param {string} title - Song title
   * @param {string} artist - Artist name
   * @returns {Promise<{query: string, results: Array, summary: string, timestamp: string}>}
   * @throws {Error} if search cannot be performed
   */
  async searchSongInfo(title, artist) {
    throw new Error('searchSongInfo() not implemented');
  }

  /**
   * General search query
   * @param {string} query - Search query
   * @param {number} maxResults - Max results to fetch
   * @returns {Promise<{query: string, results: Array}>}
   */
  async search(query, maxResults = 10) {
    throw new Error('search() not implemented');
  }
}
