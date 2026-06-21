import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SongService } from '../../services/songService.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';
import { FilesystemAudioStorageAdapter } from '../../services/audioStorageService.js';

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

  describe('crossVerifyAnalysis', () => {
    let mockAiService;
    let localSongService;

    beforeEach(() => {
      mockSearchService = {
        search: jest.fn().mockResolvedValue({
          results: [{ title: 'Web Page', content: 'The tempo is 120 bpm in the key of G minor with 4/4 meter.' }]
        })
      };
      mockAiService = {
        completeJson: jest.fn().mockResolvedValue({
          tempo_bpm: 120,
          key: 'G',
          scale: 'minor',
          estimated_meter: '4/4'
        })
      };
      localSongService = new SongService(songRepository, mockSearchService, mockAiService);
    });

    test('should agree on same values and promote confidence to 0.95 and mark cross_verified', async () => {
      const song = await songRepository.create({
        title: 'Song',
        artistName: 'Artist',
        userId: 'user-1',
        audioAnalysisStatus: 'success',
        audioAnalysis: {
          tempo_bpm: 120.2,
          tempo_confidence: 0.7,
          key: 'G',
          scale: 'minor',
          key_confidence: 0.6,
          estimated_meter: '4/4',
          meter_confidence: 0.8
        }
      });

      const updated = await localSongService.crossVerifyAnalysis(song._id, 'user-1');
      expect(updated.audioAnalysis.tempo_confidence).toBe(0.95);
      expect(updated.audioAnalysis.tempo_cross_verified).toBe(true);
      expect(updated.audioAnalysis.key_confidence).toBe(0.95);
      expect(updated.audioAnalysis.key_cross_verified).toBe(true);
      expect(updated.audioAnalysis.meter_confidence).toBe(0.95);
      expect(updated.audioAnalysis.meter_cross_verified).toBe(true);
    });

    test('should override low confidence values with Tavily values and mark cross_verified', async () => {
      const song = await songRepository.create({
        title: 'Song',
        artistName: 'Artist',
        userId: 'user-1',
        audioAnalysisStatus: 'success',
        audioAnalysis: {
          tempo_bpm: 80,
          tempo_confidence: 0.4,
          key: 'C',
          scale: 'major',
          key_confidence: 0.3,
          estimated_meter: '3/4',
          meter_confidence: 0.5
        }
      });

      const updated = await localSongService.crossVerifyAnalysis(song._id, 'user-1');
      expect(updated.audioAnalysis.tempo_bpm).toBe(120);
      expect(updated.audioAnalysis.tempo_confidence).toBe(0.95);
      expect(updated.audioAnalysis.tempo_cross_verified).toBe(true);
      expect(updated.audioAnalysis.key).toBe('G');
      expect(updated.audioAnalysis.scale).toBe('minor');
      expect(updated.audioAnalysis.key_confidence).toBe(0.95);
      expect(updated.audioAnalysis.key_cross_verified).toBe(true);
      expect(updated.audioAnalysis.estimated_meter).toBe('4/4');
      expect(updated.audioAnalysis.meter_confidence).toBe(0.95);
      expect(updated.audioAnalysis.meter_cross_verified).toBe(true);
    });
  });

  describe('attachLocalAudio', () => {
    let tmpRoot;
    let sourceFile;
    let audioStorage;
    let serviceWithStorage;

    beforeEach(() => {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arra-svc-test-'));
      // FilesystemAudioStorageAdapter always writes under <root>/songs/.
      sourceFile = path.join(tmpRoot, 'source.mp3');
      fs.writeFileSync(sourceFile, Buffer.from('fake-mp3-bytes'));
      audioStorage = new FilesystemAudioStorageAdapter({ uploadsRoot: tmpRoot });
      serviceWithStorage = new SongService(
        songRepository,
        mockSearchService,
        null,
        audioStorage
      );
    });

    afterEach(() => {
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* ignore */ }
    });

    test('moves the file into the songs dir and sets publicUrl/sourceType on the song', async () => {
      const song = await songRepository.create({
        title: 'Local Audio Song',
        userId: 'user-1',
        sourceType: 'youtube',
        publicUrl: null,
      });

      const updated = await serviceWithStorage.attachLocalAudio(song._id, sourceFile, {
        mimeType: 'audio/mpeg',
        extension: 'mp3',
      });

      expect(updated.sourceType).toBe('local');
      expect(updated.publicUrl).toBe(`/uploads/songs/${song._id}.mp3`);
      expect(updated.audioMimeType).toBe('audio/mpeg');
      expect(updated.audioSizeBytes).toBe(Buffer.byteLength('fake-mp3-bytes'));
      // InMemoryRepository clones Dates → ISO strings, so just check
      // the value is a parseable timestamp from before "now".
      expect(new Date(updated.audioDownloadedAt).getTime()).toBeLessThanOrEqual(Date.now());
      // File actually landed on disk under <root>/songs/{songId}.mp3.
      expect(fs.existsSync(path.join(tmpRoot, 'songs', `${song._id}.mp3`))).toBe(true);
    });

    test('throws when audioStorageService is null (regression: server.js wiring bug)', async () => {
      const song = await songRepository.create({
        title: 'Local Audio Song',
        userId: 'user-1',
        sourceType: 'youtube',
        publicUrl: null,
      });
      // songService from the outer beforeEach has no audioStorageService
      // (mirrors the server.js bug where the 4th constructor arg was
      // dropped). attachLocalAudio must throw, not silently no-op.
      await expect(
        songService.attachLocalAudio(song._id, sourceFile, { extension: 'mp3' })
      ).rejects.toThrow(/audioStorageService/);
    });
  });
});
