import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { SketchService } from '../../services/SketchService.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';

function mockFile({ originalname = 'sketch.wav', mimetype = 'audio/wav', size = 1024, filename = 'sketch-1.wav', path: filePath = '/tmp/sketch-1.wav' } = {}) {
  return { originalname, mimetype, size, filename, path: filePath };
}

describe('SketchService Unit Tests', () => {
  let sketchService;
  let sketchRepository;
  let songRepository;

  beforeEach(() => {
    sketchRepository = new InMemoryRepository();
    songRepository = new InMemoryRepository();
    sketchService = new SketchService(sketchRepository, songRepository);
  });

  describe('createSketch', () => {
    test('creates a sketch owned by the user with default fields', async () => {
      const song = await songRepository.create({ userId: 'user-1', title: 'Song', deletedAt: null });
      const file = mockFile({ originalname: 'demo.wav', size: 5000, filename: 'sketch-abc.wav', path: '/tmp/sketch-abc.wav' });

      const sketch = await sketchService.createSketch({
        userId: 'user-1',
        songId: song._id,
        file,
        title: 'My demo',
        notes: 'first attempt',
      });

      expect(sketch._id).toBeDefined();
      expect(sketch.userId).toBe('user-1');
      expect(sketch.songId).toBe(song._id);
      expect(sketch.title).toBe('My demo');
      expect(sketch.fileName).toBe('sketch-abc.wav');
      expect(sketch.publicUrl).toBe('/uploads/sketch-abc.wav');
      expect(sketch.sizeBytes).toBe(5000);
      expect(sketch.analysisStatus).toBe('not_started');
      expect(sketch.analysis).toBeNull();
    });

    test('rejects unsupported file extensions', async () => {
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      const file = mockFile({ originalname: 'evil.exe', path: '/tmp/evil.exe', filename: 'sketch-1.exe' });
      await expect(
        sketchService.createSketch({ userId: 'user-1', songId: song._id, file })
      ).rejects.toThrow(/Unsupported file type/);
    });

    test('rejects files larger than the limit', async () => {
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      const file = mockFile({ size: 200 * 1024 * 1024, originalname: 'huge.wav' });
      await expect(
        sketchService.createSketch({ userId: 'user-1', songId: song._id, file })
      ).rejects.toThrow(/File too large/);
    });

    test('rejects if song is owned by a different user', async () => {
      const song = await songRepository.create({ userId: 'someone-else', deletedAt: null });
      const file = mockFile();
      await expect(
        sketchService.createSketch({ userId: 'user-1', songId: song._id, file })
      ).rejects.toThrow(/Song not found/);
    });
  });

  describe('list / get / delete', () => {
    test('getSketchesForSong returns only non-deleted for the user', async () => {
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      await sketchService.createSketch({ userId: 'user-1', songId: song._id, file: mockFile({ filename: 'a.wav', path: '/tmp/a.wav' }) });
      await sketchService.createSketch({ userId: 'user-1', songId: song._id, file: mockFile({ filename: 'b.wav', path: '/tmp/b.wav' }) });
      const all = await sketchService.getSketchesForSong(song._id, 'user-1');
      expect(all).toHaveLength(2);
      expect(all.map((s) => s.fileName)).toEqual(expect.arrayContaining(['a.wav', 'b.wav']));
      // soft-delete one and confirm it disappears from list
      await sketchService.deleteSketch(all[0]._id, 'user-1');
      const after = await sketchService.getSketchesForSong(song._id, 'user-1');
      expect(after).toHaveLength(1);
    });

    test('getSketch scopes by user', async () => {
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      const sketch = await sketchService.createSketch({ userId: 'user-1', songId: song._id, file: mockFile({ filename: 'a.wav', path: '/tmp/a.wav' }) });
      const got = await sketchService.getSketch(sketch._id, 'user-1');
      expect(got._id).toBe(sketch._id);
      await expect(sketchService.getSketch(sketch._id, 'user-2')).rejects.toThrow(/Sketch not found/);
    });

    test('deleteSketch soft-deletes and returns the updated record', async () => {
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      const sketch = await sketchService.createSketch({ userId: 'user-1', songId: song._id, file: mockFile({ filename: 'a.wav', path: '/tmp/a.wav' }) });
      const out = await sketchService.deleteSketch(sketch._id, 'user-1');
      expect(out.deletedAt).toBeTruthy();
      // subsequent get throws
      await expect(sketchService.getSketch(sketch._id, 'user-1')).rejects.toThrow(/Sketch not found/);
    });
  });

  describe('updateSketch', () => {
    test('updates allowed metadata fields and persists them', async () => {
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      const sketch = await sketchService.createSketch({
        userId: 'user-1',
        songId: song._id,
        file: mockFile({ filename: 'a.wav', path: '/tmp/a.wav' }),
        title: 'orig',
      });
      const out = await sketchService.updateSketch(sketch._id, 'user-1', {
        title: 'renamed',
        notes: 'updated note',
        durationSeconds: 42.5,
      });
      expect(out.title).toBe('renamed');
      expect(out.notes).toBe('updated note');
      expect(out.durationSeconds).toBe(42.5);
    });

    test('rejects unknown fields silently (whitelist)', async () => {
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      const sketch = await sketchService.createSketch({
        userId: 'user-1',
        songId: song._id,
        file: mockFile({ filename: 'a.wav', path: '/tmp/a.wav' }),
      });
      const out = await sketchService.updateSketch(sketch._id, 'user-1', {
        userId: 'attacker',
        analysis: { evil: true },
        durationSeconds: 5,
      });
      expect(out.userId).toBe('user-1');
      expect(out.analysis == null).toBe(true);
      expect(out.durationSeconds).toBe(5);
    });

    test('rejects out-of-range durationSeconds', async () => {
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      const sketch = await sketchService.createSketch({
        userId: 'user-1',
        songId: song._id,
        file: mockFile({ filename: 'a.wav', path: '/tmp/a.wav' }),
      });
      await expect(
        sketchService.updateSketch(sketch._id, 'user-1', { durationSeconds: -1 })
      ).rejects.toThrow(/durationSeconds/);
      await expect(
        sketchService.updateSketch(sketch._id, 'user-1', { durationSeconds: 'not a number' })
      ).rejects.toThrow(/durationSeconds/);
    });

    test('returns 404 for sketches owned by other users', async () => {
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      const sketch = await sketchService.createSketch({
        userId: 'user-1',
        songId: song._id,
        file: mockFile({ filename: 'a.wav', path: '/tmp/a.wav' }),
      });
      await expect(
        sketchService.updateSketch(sketch._id, 'user-2', { durationSeconds: 1 })
      ).rejects.toThrow(/Sketch not found/);
    });
  });

  describe('analyzeSketch', () => {
    test('sends sketch to analysis service and stores the result', async () => {
      // Mock axios by monkey-patching SketchService's call site. We do this
      // by setting the analysisServiceUrl to a fake host and stubbing axios.
      // Easier: stub the SketchService method by overriding the analysis path.
      // Here we use jest.unstable_mockModule to mock axios.
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      // Touch the file so it exists on disk (in-memory fs via mock)
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, `sketch-test-${Date.now()}.wav`);
      fs.writeFileSync(tmpFile, 'RIFFmock');

      const sketch = await sketchService.createSketch({
        userId: 'user-1',
        songId: song._id,
        file: mockFile({ filename: 'fake.wav', path: tmpFile, size: 8 }),
      });

      // Stub axios.post to return a fake analysis
      const axios = (await import('axios')).default;
      const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
        data: { analysis: { tempo_bpm: 120, key: 'C', scale: 'major' } },
      });

      const out = await sketchService.analyzeSketch(sketch._id, 'user-1');
      expect(postSpy).toHaveBeenCalledTimes(1);
      const [url, payload] = postSpy.mock.calls[0];
      expect(url).toMatch(/\/analyze-sketch$/);
      expect(payload).toMatchObject({ sketch_id: sketch._id, file_path: tmpFile });

      expect(out.queued).toBe(false);
      expect(out.analysis).toEqual({ tempo_bpm: 120, key: 'C', scale: 'major' });
      expect(out.sketch.analysisStatus).toBe('success');
      expect(out.sketch.analysis).toEqual({ tempo_bpm: 120, key: 'C', scale: 'major' });

      postSpy.mockRestore();
      fs.unlinkSync(tmpFile);
    });

    test('marks analysis failed when the service errors', async () => {
      const song = await songRepository.create({ userId: 'user-1', deletedAt: null });
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');
      const tmpFile = path.join(os.tmpdir(), `sketch-fail-${Date.now()}.wav`);
      fs.writeFileSync(tmpFile, 'RIFFmock');
      const sketch = await sketchService.createSketch({
        userId: 'user-1',
        songId: song._id,
        file: mockFile({ filename: 'fake.wav', path: tmpFile, size: 8 }),
      });

      const axios = (await import('axios')).default;
      const postSpy = jest.spyOn(axios, 'post').mockRejectedValue(new Error('boom'));

      await expect(sketchService.analyzeSketch(sketch._id, 'user-1')).rejects.toThrow(/Sketch analysis failed/);
      const after = await sketchService.getSketch(sketch._id, 'user-1');
      expect(after.analysisStatus).toBe('failed');
      expect(after.analysisError).toMatch(/boom/);

      postSpy.mockRestore();
      fs.unlinkSync(tmpFile);
    });
  });
});
