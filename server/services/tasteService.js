export class TasteService {
  constructor(tasteProfileRepository, searchService, aiService) {
    if (!tasteProfileRepository) {
      throw new Error('TasteService requires a tasteProfileRepository');
    }
    this.tasteProfileRepo = tasteProfileRepository;
    this.searchService = searchService;
    this.aiService = aiService;
  }

  /**
   * Get all synthesized taste profiles for a user
   * 
   * @param {string} userId 
   * @returns {Promise<Array>} List of taste profiles
   */
  async getProfilesForUser(userId) {
    return this.tasteProfileRepo.find({ userId });
  }

  /**
   * Execute a deep-dive research and synthesis for a taste (artist/band/musician)
   * 
   * @param {string} userId - User ID triggering the research
   * @param {string} lens - Rhythm, texture, harmony, or arrangement
   * @param {string} name - The artist, band, or musician name
   * @returns {Promise<Object>} The created or updated TasteProfile
   */
  async executeDeepDive(userId, lens, name) {
    if (!lens || !name) {
      throw new Error('Lens and taste/artist name are required');
    }

    const trimmedName = name.trim();
    const query = `${trimmedName} signature ${lens} music production techniques analysis style`;
    console.log(`[Taste Deep Dive] Starting Tavily search for: "${query}" (10 sources)`);

    let sources = [];
    if (this.searchService) {
      try {
        const searchResult = await this.searchService.search(query, 10);
        sources = searchResult?.results || [];
        console.log(`[Taste Deep Dive] Tavily search retrieved ${sources.length} sources.`);
      } catch (err) {
        console.error(`[Taste Deep Dive] Tavily search failed: ${err.message}`);
      }
    }

    // Prepare sources text for prompt
    let sourcesText = 'No online sources retrieved.';
    if (sources.length > 0) {
      sourcesText = sources
        .map((s, idx) => `[Source ${idx + 1} - ${s.title}]:\n${s.content}\nURL: ${s.url}`)
        .join('\n\n');
    }

    // Call AI to synthesize style profile
    let summary = '';
    const prompt = `You are a music production and musicology expert.
We want to analyze the characteristic style of the following artist/band/musician to build a reference "taste profile" for our song auditing system.

Artist/Band: "${trimmedName}"
Lens Focus: ${lens} (e.g., rhythm means pocket, timing, swing, fills, accents; texture means timbre, space, delays, EQ, mixing styles; harmony means chord progressions, voicings, keys, key changes; arrangement means structure, transitions, build-ups, entries/exits).

Here is a collection of web search research sources about this artist/band focusing on their techniques, production, and musical styles:
${sourcesText}

Based on these sources and your deep musical knowledge, synthesize a concrete, highly detailed analysis of this taste profile.
Structure your analysis with:
1. KEY TECHNIQUES: 3-4 specific techniques, approaches, or performance quirks they use (e.g. "ahead of the grid pocket", "washed-out tape modulation", "pedal tones for harmonic ambiguity"). Explain exactly what it is and why it works.
2. DAW APPLICATION EXERCISE GUIDE: Concrete, step-by-step instructions for how a producer can recreate or apply these techniques inside a DAW (like Bitwig) in their own loops/writing (e.g. MIDI note editing, specific plugin styles, time alignment, reverb/delay lengths, stepwise bass motion).

Be highly technical and actionable. Do not use generic fluff.`;

    if (this.aiService) {
      try {
        console.log(`[Taste Deep Dive] Synthesizing style profile for "${trimmedName}"...`);
        summary = await this.aiService.completeText(prompt);
      } catch (err) {
        console.error(`[Taste Deep Dive] AI synthesis failed: ${err.message}`);
        summary = `Failed to synthesize style profile from sources. Reason: ${err.message}`;
      }
    } else {
      summary = `Mock style profile summary for "${trimmedName}" under the ${lens} lens.`;
    }

    // Find if a profile already exists for this user, lens, and artist name
    let profile = null;
    try {
      const existing = await this.tasteProfileRepo.findOne({
        userId,
        lens,
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      });

      if (existing) {
        console.log(`[Taste Deep Dive] Updating existing taste profile for "${trimmedName}" (${lens})`);
        profile = await this.tasteProfileRepo.updateById(existing._id, {
          summary,
          sources,
          updatedAt: new Date(),
        });
      } else {
        console.log(`[Taste Deep Dive] Creating new taste profile for "${trimmedName}" (${lens})`);
        profile = await this.tasteProfileRepo.create({
          userId,
          lens,
          name: trimmedName,
          summary,
          sources,
        });
      }
    } catch (err) {
      // If we don't have MongoDB or standard repo fails (e.g. in test), fall back
      console.warn(`[Taste Deep Dive] DB write failed: ${err.message}`);
      profile = {
        userId,
        lens,
        name: trimmedName,
        summary,
        sources,
      };
    }

    return profile;
  }
}
