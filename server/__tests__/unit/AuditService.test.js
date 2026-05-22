import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { AuditService } from '../../services/auditService.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';

describe('AuditService Unit Tests', () => {
  let auditService;
  let auditRepository;
  let techniqueRepository;
  let songRepository;

  beforeEach(() => {
    auditRepository = new InMemoryRepository();
    techniqueRepository = new InMemoryRepository();
    songRepository = new InMemoryRepository();
    auditService = new AuditService(auditRepository, techniqueRepository, songRepository);
  });

  describe('Trash/Restore/Purge operations', () => {
    test('should get only soft-deleted audits if parent song is active', async () => {
      const activeSong = await songRepository.create({ title: 'Active Song', userId: 'user-1', deletedAt: null });
      const deletedSong = await songRepository.create({ title: 'Deleted Song', userId: 'user-1', deletedAt: new Date() });

      // Audit with active parent song, soft-deleted
      const audit1 = await auditRepository.create({
        songId: activeSong._id,
        userId: 'user-1',
        deletedAt: new Date('2023-01-01'),
        lensSelection: ['rhythm']
      });

      // Audit with deleted parent song, soft-deleted
      const audit2 = await auditRepository.create({
        songId: deletedSong._id,
        userId: 'user-1',
        deletedAt: new Date('2023-01-02'),
        lensSelection: ['rhythm']
      });

      // Active audit (not deleted)
      const audit3 = await auditRepository.create({
        songId: activeSong._id,
        userId: 'user-1',
        deletedAt: null,
        lensSelection: ['texture']
      });

      const results = await auditService.getDeletedAudits('user-1');
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe(audit1._id);
      expect(results[0].songId._id).toBe(activeSong._id); // song is populated
    });

    test('should restore an audit and its techniques', async () => {
      const activeSong = await songRepository.create({ title: 'Active Song', userId: 'user-1', deletedAt: null });
      const deletedTime = new Date();
      const audit = await auditRepository.create({
        songId: activeSong._id,
        userId: 'user-1',
        deletedAt: deletedTime,
        lensSelection: ['rhythm']
      });
      const tech = await techniqueRepository.create({
        auditId: audit._id,
        userId: 'user-1',
        deletedAt: deletedTime
      });

      const success = await auditService.restoreAudit(audit._id, 'user-1', techniqueRepository);
      expect(success).toBe(true);

      const restoredAudit = await auditRepository.findById(audit._id);
      expect(restoredAudit.deletedAt).toBeNull();

      const restoredTech = await techniqueRepository.findById(tech._id);
      expect(restoredTech.deletedAt).toBeNull();
    });

    test('should fail to restore audit if parent song is deleted', async () => {
      const deletedSong = await songRepository.create({ title: 'Deleted Song', userId: 'user-1', deletedAt: new Date() });
      const audit = await auditRepository.create({
        songId: deletedSong._id,
        userId: 'user-1',
        deletedAt: new Date(),
        lensSelection: ['rhythm']
      });

      await expect(auditService.restoreAudit(audit._id, 'user-1', techniqueRepository))
        .rejects.toThrow('Cannot restore audit because its parent song is deleted');
    });

    test('should purge an audit and its techniques', async () => {
      const audit = await auditRepository.create({
        songId: 'song-1',
        userId: 'user-1',
        deletedAt: new Date(),
        lensSelection: ['rhythm']
      });
      const tech = await techniqueRepository.create({
        auditId: audit._id,
        userId: 'user-1',
        deletedAt: new Date()
      });

      const success = await auditService.purgeAudit(audit._id, 'user-1', techniqueRepository);
      expect(success).toBe(true);

      const foundAudit = await auditRepository.findById(audit._id);
      expect(foundAudit).toBeNull();

      const foundTech = await techniqueRepository.findById(tech._id);
      expect(foundTech).toBeNull();
    });
  });
});
