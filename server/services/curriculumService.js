export class CurriculumService {
  constructor(curriculumRepository, studyProgressRepository, songRepository, auditService, techniqueRepository, aiAdapter) {
    this.curriculumRepository = curriculumRepository;
    this.studyProgressRepository = studyProgressRepository;
    this.songRepository = songRepository;
    this.auditService = auditService;
    this.techniqueRepository = techniqueRepository;
    this.aiAdapter = aiAdapter;
  }

  /**
   * Queries OpenAIAdapter to generate a customized 7-day study plan.
   *
   * @param {string} userId
   * @param {string} focusArea
   * @param {Array<Object>} pastTechniques
   * @returns {Promise<Object>} Generated curriculum structure
   */
  async generateAICurriculum(userId, focusArea, pastTechniques = []) {
    if (!this.aiAdapter) {
      throw new Error('AI Adapter is not configured');
    }

    const techniquesSummary = pastTechniques && pastTechniques.length > 0
      ? pastTechniques.map(t => `- ${t.techniqueName || t.name}: ${t.description} (Lens: ${t.lens || t.category}, Artist: ${t.artist})`).join('\n')
      : 'No past techniques logged yet.';

    const prompt = `You are a professional music production mentor and curriculum designer.
Generate a customized 7-day study plan (1 week) focusing on the area of: "${focusArea}".
The user has previously logged the following steal moves or music techniques in their notebook:
${techniquesSummary}

Please construct a curriculum that helps them build upon or explore concepts relevant to their focus area.

You MUST respond with a single, valid JSON object containing exactly the structure below.
Do not wrap it in markdown or add extra text. The output must parse directly as JSON.

JSON Schema:
{
  "title": "7-Day custom curriculum title reflecting the focus",
  "description": "A detailed explanation of what this study plan covers and how it helps the user.",
  "audience": "Music producer interested in ${focusArea}",
  "focusAreas": ["${focusArea}"],
  "durationWeeks": 1,
  "days": [
    {
      "dayNumber": 1,
      "lens": "harmony", 
      "songQuery": "Artist - Song Name for search recommendation",
      "songTitle": "Song Name",
      "artistName": "Artist",
      "listeningPrompt": "Specific listening prompt focusing on the lens for this day.",
      "applicationPrompt": "An actionable DAW application prompt or sketch challenge.",
      "logFields": [
        { "key": "harmony_notes", "label": "Harmony Notes", "fieldType": "textarea" },
        { "key": "steal_move", "label": "Steal Move (What would you copy?)", "fieldType": "textarea" }
      ]
    }
  ]
}

CRITICAL RULES:
1. Generate exactly 7 days, numbered 1 to 7.
2. The "lens" for each day must be one of: 'harmony', 'rhythm', 'texture', 'arrangement'.
3. Set the "logFields" to include a field for general notes and always include a "steal_move" field so they can log a key takeaway.
4. All text fields should be detailed, encouraging, and pedagogically sound.`;

    try {
      return await this.aiAdapter.completeJson(prompt);
    } catch (error) {
      console.error('Failed to parse AI response:', error.message);
      throw new Error(`AI generated invalid JSON: ${error.message}`);
    }
  }

  /**
   * Saves the generated AI curriculum.
   */
  async saveCustomCurriculum(userId, curriculumData) {
    const slug = `custom-plan-${userId}-${Date.now()}`;
    const dataToSave = {
      ...curriculumData,
      slug,
      creatorType: 'ai',
      userId,
    };
    return this.curriculumRepository.create(dataToSave);
  }

  /**
   * Fetch a StudyProgress document by ID with curriculum and song relations populated.
   */
  async getPopulatedStudyProgress(id) {
    return this.studyProgressRepository.findByIdWithRelations(id, [
      { path: 'curriculumId', resolver: (curriculumId) => this.curriculumRepository.findById(curriculumId) },
      { path: 'dayProgress.songId', resolver: (songId) => this.songRepository ? this.songRepository.findById(songId) : null }
    ]);
  }

  /**
   * Initializes StudyProgress for a user.
   */
  async startCurriculum(userId, curriculumId) {
    const existing = await this.studyProgressRepository.findOne({ userId, curriculumId });
    if (existing) {
      return existing;
    }

    const curriculum = await this.curriculumRepository.findById(curriculumId);
    if (!curriculum) {
      throw new Error('Curriculum not found');
    }

    const dayProgress = curriculum.days.map((day) => ({
      dayNumber: day.dayNumber,
      songId: null,
      auditId: null,
      responses: {},
      audioFilePath: null,
      audioOriginalName: null,
      status: day.dayNumber === 1 ? 'active' : 'pending',
      completedAt: null
    }));

    const durationWeeks = curriculum.durationWeeks || Math.ceil(curriculum.days.length / 7) || 1;
    const weeklyReviews = [];
    for (let w = 1; w <= durationWeeks; w++) {
      weeklyReviews.push({
        weekNumber: w,
        changedInEars: '',
        notUnderstood: '',
        nextInvestigationQuestion: '',
        completedAt: null
      });
    }

    const progressData = {
      userId,
      curriculumId,
      currentDay: 1,
      dayProgress,
      weeklyReviews,
      status: 'active'
    };

    return this.studyProgressRepository.create(progressData);
  }

  /**
   * Links a song to the active day.
   */
  async linkSongToDay(userId, progressId, dayNumber, songId) {
    const progress = await this.studyProgressRepository.findById(progressId);
    if (!progress) {
      throw new Error('Study progress not found');
    }
    if (progress.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    const dayNumberNum = Number(dayNumber);
    const day = progress.dayProgress.find(d => d.dayNumber === dayNumberNum);
    if (!day) {
      throw new Error(`Day ${dayNumber} not found in this curriculum`);
    }

    if (this.songRepository) {
      const song = await this.songRepository.findById(songId);
      if (!song) {
        throw new Error('Song not found');
      }
    }

    day.songId = songId;

    return this.studyProgressRepository.updateById(progressId, {
      dayProgress: progress.dayProgress
    });
  }

  /**
   * Saves temporary answers.
   */
  async logDayProgress(userId, progressId, dayNumber, responses) {
    const progress = await this.studyProgressRepository.findById(progressId);
    if (!progress) {
      throw new Error('Study progress not found');
    }
    if (progress.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    const dayNumberNum = Number(dayNumber);
    const day = progress.dayProgress.find(d => d.dayNumber === dayNumberNum);
    if (!day) {
      throw new Error(`Day ${dayNumber} not found in this curriculum`);
    }

    day.responses = { ...day.responses, ...responses };

    return this.studyProgressRepository.updateById(progressId, {
      dayProgress: progress.dayProgress
    });
  }

  /**
   * Completes a day, builds standard audit, and optionally logs techniques.
   */
  async completeDayProgress(userId, progressId, dayNumber, responses, syncTechnique, techniqueNotes, auditData = {}) {
    const progress = await this.studyProgressRepository.findById(progressId);
    if (!progress) {
      throw new Error('Study progress not found');
    }
    if (progress.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    const dayNumberNum = Number(dayNumber);
    const day = progress.dayProgress.find(d => d.dayNumber === dayNumberNum);
    if (!day) {
      throw new Error(`Day ${dayNumber} not found in this curriculum`);
    }

    // Save responses and set status to completed
    day.responses = { ...day.responses, ...responses };
    day.status = 'completed';
    day.completedAt = new Date();

    // Retrieve the curriculum to get day details
    const curriculum = await this.curriculumRepository.findById(progress.curriculumId);
    if (!curriculum) {
      throw new Error('Curriculum not found');
    }
    const currDay = curriculum.days.find(d => d.dayNumber === dayNumberNum);
    if (!currDay) {
      throw new Error(`Day ${dayNumber} metadata not found in curriculum`);
    }

    // Create a standard Audit in the database via auditService.createAudit()
    const songId = day.songId || auditData.songId;
    let audit = null;
    if (songId && this.auditService) {
      const lensSelection = auditData.lensSelection || [currDay.lens];
      const createdAudit = await this.auditService.createAudit({
        songId,
        userId,
        lensSelection,
        workflowType: auditData.workflowType || 'quick',
        templateQuestions: auditData.templateQuestions || null,
        templateVersion: auditData.templateVersion || null,
        modelUsed: auditData.modelUsed || null,
        promptVersion: auditData.promptVersion || 'v1',
        responses: day.responses,
      });
      audit = createdAudit;
      day.auditId = createdAudit._id;
    }

    // If syncTechnique is true, create a new TechniqueEntry in the notebook
    if (syncTechnique) {
      const description = responses['steal_move'] || responses['steal_notes'] || responses['steal'] || '';
      
      let artist = currDay.artistName || 'Unknown';
      if (songId && this.songRepository) {
        const song = await this.songRepository.findById(songId);
        if (song && song.artist) {
          artist = song.artist;
        }
      }

      const techniqueData = {
        userId,
        songId: songId || null,
        auditId: audit ? audit._id : null,
        techniqueName: `Steal Move (Day ${dayNumber})`,
        description: description || techniqueNotes || 'Steal move from curriculum study',
        lens: currDay.lens,
        artist: artist,
        exampleTimestamp: 0,
        tags: ['study-planner'],
        notes: techniqueNotes || '',
        confidence: 3,
        deletedAt: null,
        createdAt: new Date()
      };

      if (this.techniqueRepository) {
        await this.techniqueRepository.create(techniqueData);
      }
    }

    // Increment currentDay and save progress
    const nextDayNumber = dayNumberNum + 1;
    const nextDay = progress.dayProgress.find(d => d.dayNumber === nextDayNumber);
    if (nextDay && nextDay.status === 'pending') {
      nextDay.status = 'active';
    }

    progress.currentDay = Math.max(progress.currentDay, nextDayNumber);

    // If all days are completed, mark the study progress status as 'completed'
    const allCompleted = progress.dayProgress.every(d => d.status === 'completed');
    if (allCompleted) {
      progress.status = 'completed';
    }

    return this.studyProgressRepository.updateById(progressId, {
      dayProgress: progress.dayProgress,
      currentDay: progress.currentDay,
      status: progress.status
    });
  }

  /**
   * Saves weekly reflections.
   */
  async submitWeeklyReview(userId, progressId, weekNumber, reviewData) {
    const progress = await this.studyProgressRepository.findById(progressId);
    if (!progress) {
      throw new Error('Study progress not found');
    }
    if (progress.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    const weekNumberNum = Number(weekNumber);
    let review = progress.weeklyReviews.find(r => r.weekNumber === weekNumberNum);
    if (!review) {
      review = {
        weekNumber: weekNumberNum,
        changedInEars: '',
        notUnderstood: '',
        nextInvestigationQuestion: '',
        completedAt: null
      };
      progress.weeklyReviews.push(review);
    }

    review.changedInEars = reviewData.changedInEars ?? review.changedInEars;
    review.notUnderstood = reviewData.notUnderstood ?? review.notUnderstood;
    review.nextInvestigationQuestion = reviewData.nextInvestigationQuestion ?? review.nextInvestigationQuestion;
    review.completedAt = new Date();

    return this.studyProgressRepository.updateById(progressId, {
      weeklyReviews: progress.weeklyReviews
    });
  }
}
