import test from 'node:test';
import assert from 'node:assert/strict';
import { RedisLockManager } from '../../src/infrastructure/redis.js';

test('Distributed Lock: Atomic multi-resource lock acquires successfully', async () => {
  const lockManager = new RedisLockManager();
  const resIds = [`test_res_${Date.now()}_1`, `test_res_${Date.now()}_2`];
  const reservationId = `resv_${Date.now()}_a`;

  const acquired = await lockManager.acquireMultiLock(resIds, reservationId, 60);
  assert.equal(acquired, true, 'Initial multi-resource lock acquisition must succeed');

  // Attempt to acquire conflicting lock on the same resources by another reservation
  const conflictingReservation = `resv_${Date.now()}_b`;
  const conflictAcquired = await lockManager.acquireMultiLock(resIds, conflictingReservation, 60);
  assert.equal(conflictAcquired, false, 'Conflicting lock acquisition must be rejected');

  // Clean up
  await lockManager.releaseMultiLock(resIds, reservationId);

  // After release, new lock must succeed
  const afterReleaseAcquired = await lockManager.acquireMultiLock(resIds, conflictingReservation, 60);
  assert.equal(afterReleaseAcquired, true, 'Lock acquisition after release must succeed');

  await lockManager.releaseMultiLock(resIds, conflictingReservation);
});

test('Distributed Lock: Partial collision aborts entire bundle acquisition (all-or-nothing atomicity)', async () => {
  const lockManager = new RedisLockManager();
  const resA = `test_res_${Date.now()}_x`;
  const resB = `test_res_${Date.now()}_y`;

  const reservation1 = `resv_1_${Date.now()}`;
  const reservation2 = `resv_2_${Date.now()}`;

  // Lock resA
  const acquiredA = await lockManager.acquireMultiLock([resA], reservation1, 60);
  assert.equal(acquiredA, true);

  // Reservation 2 attempts to lock [resA, resB] -> Must fail completely
  const acquiredBundle = await lockManager.acquireMultiLock([resA, resB], reservation2, 60);
  assert.equal(acquiredBundle, false, 'Bundle acquisition containing an already locked resource must fail');

  // Verify resB was NOT partially locked
  const reservation3 = `resv_3_${Date.now()}`;
  const acquiredB = await lockManager.acquireMultiLock([resB], reservation3, 60);
  assert.equal(acquiredB, true, 'Partial lock must not linger after bundle failure');

  // Clean up
  await lockManager.releaseMultiLock([resA], reservation1);
  await lockManager.releaseMultiLock([resB], reservation3);
});
