import express from 'express';

export default function createTasteRoutes(tasteService) {
  const router = express.Router();

  // GET /api/tastes - Get all taste profiles for current user
  router.get('/', async (req, res) => {
    try {
      const userId = req.userId;
      const profiles = await tasteService.getProfilesForUser(userId);
      res.json(profiles);
    } catch (error) {
      console.error('Get taste profiles error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/tastes/research - Trigger a deep-dive web search + AI synthesis for a taste profile
  router.post('/research', async (req, res) => {
    try {
      const userId = req.userId;
      const { lens, name } = req.body;

      if (!lens || !name) {
        return res.status(400).json({ error: 'lens and name are required' });
      }

      const validLenses = ['rhythm', 'texture', 'harmony', 'arrangement'];
      if (!validLenses.includes(lens)) {
        return res.status(400).json({ error: `Invalid lens. Must be one of: ${validLenses.join(', ')}` });
      }

      console.log(`[Taste Route] Triggering deep research dive for user ${userId} on ${lens} taste: "${name}"`);
      const profile = await tasteService.executeDeepDive(userId, lens, name);

      res.status(200).json({ profile });
    } catch (error) {
      console.error('Taste research error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
