import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { SongService } from '../../services/songService.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';

describe('SongService Unit Tests', () => {
  let songService;
  let songRepository;
  let mockSearchService;

  beforeEach(() => {
    songRepository = new InMemoryRepository();
    mockSearchService = {
      searchSongInfo: jest.fn()
    };
    songService = new SongService(songRepository, mockSearchService);
  });

  describe('importSong', () => {
    test('should save a new song correctly', async () => {
      const songData = {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        youtubeId: 'fJ9rUzIMcZQ',
        youtubeUrl: 'https://youtube.com/watch?v=fJ9rUzIMcZQ',
        userId: 'user-1'
      };
      const research = { summary: 'A masterpiece' };

      const result = await songService.importSong(songData, research);

      expect(result._id).toBeDefined();
      expect(result.title).toBe('Bohemian Rhapsody');
      expect(result.researchSummary.summary).toBe('A masterpiece');
      
      const saved = await songRepository.findById(result._id);
      expect(saved.userId).toBe('user-1');
    });

    test('should throw error if song already imported by user', async () => {
      const songData = {
        title: 'Song',
        artist: 'Artist',
        youtubeId: 'id1',
        youtubeUrl: 'url1',
        userId: 'user-1'
      };

      await songService.importSong(songData, null);
      
      await expect(songService.importSong(songData, null))
        .rejects.toThrow('You have already imported this song');
    });
  });

  describe('getUserSongs', () => {
    test('should filter by search term', async () => {
      await songRepository.create({ title: 'Blue Monday', artist: 'New Order', userId: 'user-1' });
      await songRepository.create({ title: 'Bizarre Love Triangle', artist: 'New Order', userId: 'user-1' });
      await songRepository.create({ title: 'Other', artist: 'Other', userId: 'user-1' });

      const results = await songService.getUserSongs('user-1', { search: 'Blue' });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Blue Monday');
    });
  });

  describe('Trash/Restore/Purge operations', () => {
    let auditRepository;
    let techniqueRepository;
    let sketchRepository;

    beforeEach(() => {
      auditRepository = new InMemoryRepository();
      techniqueRepository = new InMemoryRepository();
      sketchRepository = new InMemoryRepository();
    });

    test('should get only soft-deleted songs', async () => {
      const active = await songRepository.create({ title: 'Active', userId: 'user-1', deletedAt: null });
      const deleted1 = await songRepository.create({ title: 'Deleted 1', userId: 'user-1', deletedAt: new Date('2023-01-01') });
      const deleted2 = await songRepository.create({ title: 'Deleted 2', userId: 'user-1', deletedAt: new Date('2023-01-02') });

      const results = await songService.getDeletedSongs('user-1');
      expect(results).toHaveLength(2);
      // Sorted by deletedAt desc
      expect(results[0].title).toBe('Deleted 2');
      expect(results[1].title).toBe('Deleted 1');
    });

    test('should restore a song and cascade to its audits and techniques', async () => {
      const deletedTime = new Date();
      const song = await songRepository.create({ title: 'Song', userId: 'user-1', deletedAt: deletedTime });
      const audit = await auditRepository.create({ songId: song._id, userId: 'user-1', deletedAt: deletedTime });
      const tech = await techniqueRepository.create({ auditId: audit._id, userId: 'user-1', deletedAt: deletedTime });

      const success = await songService.restoreSong(song._id, 'user-1', auditRepository, techniqueRepository);
      expect(success).toBe(true);

      const restoredSong = await songRepository.findById(song._id);
      expect(restoredSong.deletedAt).toBeNull();

      const restoredAudit = await auditRepository.findById(audit._id);
      expect(restoredAudit.deletedAt).toBeNull();

      const restoredTech = await techniqueRepository.findById(tech._id);
      expect(restoredTech.deletedAt).toBeNull();
    });

    test('should purge a song and cascade delete its audits and techniques', async () => {
      const song = await songRepository.create({ title: 'Song', userId: 'user-1', deletedAt: new Date() });
      const audit = await auditRepository.create({ songId: song._id, userId: 'user-1', deletedAt: new Date() });
      const tech = await techniqueRepository.create({ auditId: audit._id, userId: 'user-1', deletedAt: new Date() });

      const success = await songService.purgeSong(song._id, 'user-1', auditRepository, techniqueRepository);
      expect(success).toBe(true);

      const foundSong = await songRepository.findById(song._id);
      expect(foundSong).toBeNull();

      const foundAudit = await auditRepository.findById(audit._id);
      expect(foundAudit).toBeNull();

      const foundTech = await techniqueRepository.findById(tech._id);
      expect(foundTech).toBeNull();
    });

    test('should soft-delete a song and cascade to its sketches', async () => {
      const song = await songRepository.create({ title: 'Song', userId: 'user-1', deletedAt: null });
      const sk1 = await sketchRepository.create({ songId: song._id, userId: 'user-1', deletedAt: null });
      const sk2 = await sketchRepository.create({ songId: song._id, userId: 'user-1', deletedAt: null });
      // Sketch on a different song: should NOT be deleted
      const otherSong = await songRepository.create({ title: 'Other', userId: 'user-1', deletedAt: null });
      const skOther = await sketchRepository.create({ songId: otherSong._id, userId: 'user-1', deletedAt: null });

      const ok = await songService.deleteSong(song._id, 'user-1', auditRepository, techniqueRepository, sketchRepository);
      expect(ok).toBe(true);

      const a = await sketchRepository.findById(sk1._id);
      const b = await sketchRepository.findById(sk2._id);
      const c = await sketchRepository.findById(skOther._id);
      expect(a.deletedAt).toBeTruthy();
      expect(b.deletedAt).toBeTruthy();
      expect(c.deletedAt).toBeNull();
    });

    test('delete preview includes sketch count', async () => {
      const song = await songRepository.create({ title: 'Song', userId: 'user-1', deletedAt: null });
      await sketchRepository.create({ songId: song._id, userId: 'user-1', deletedAt: null });
      await sketchRepository.create({ songId: song._id, userId: 'user-1', deletedAt: null });
      const preview = await songService.getDeletePreview(song._id, 'user-1', auditRepository, techniqueRepository, sketchRepository);
      expect(preview.sketchCount).toBe(2);
      expect(preview.auditCount).toBe(0);
      expect(preview.techniqueCount).toBe(0);
    });
  });
});
