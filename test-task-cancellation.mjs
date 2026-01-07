#!/usr/bin/env node
/**
 * Test script to verify task cancellation works correctly
 *
 * This verifies Task 0.2: Fix Task Cancellation
 */

import { TaskStoreAdapter } from './dist/core/task-store-adapter.js';
import { InMemoryTaskStore } from './dist/core/task-store.js';

async function testTaskCancellation() {
  console.log('🧪 Testing Task Cancellation...\n');

  // Create task store adapter
  const store = new InMemoryTaskStore();
  const adapter = new TaskStoreAdapter(store);
  console.log('✓ Task store adapter created');

  // Test 1: Create a task
  const task = await adapter.createTask({ ttl: 60000 });
  console.log(`✓ Task created: ${task.taskId}`);
  console.log(`  Status: ${task.status}`);

  // Test 2: Verify task is NOT cancelled initially
  const initialCancelled = await adapter.isTaskCancelled(task.taskId);
  if (initialCancelled) {
    throw new Error('❌ Task should not be cancelled initially');
  }
  console.log('✓ Task is not cancelled initially');

  // Test 3: Call updateTaskStatus with status='cancelled'
  // This simulates what the SDK does when it receives a tasks/cancel request
  await adapter.updateTaskStatus(task.taskId, 'cancelled', 'Test cancellation');
  console.log('✓ Called updateTaskStatus with status="cancelled"');

  // Test 4: Verify task is now marked as cancelled
  const isCancelled = await adapter.isTaskCancelled(task.taskId);
  if (!isCancelled) {
    throw new Error('❌ Task should be cancelled after updateTaskStatus');
  }
  console.log('✓ Task is now cancelled (isTaskCancelled returns true)');

  // Test 5: Verify cancellation reason is set
  const reason = await adapter.getCancellationReason(task.taskId);
  if (!reason) {
    throw new Error('❌ Cancellation reason should be set');
  }
  console.log(`✓ Cancellation reason: "${reason}"`);

  // Test 6: Verify task status is updated
  const updatedTask = await adapter.getTask(task.taskId);
  if (!updatedTask || updatedTask.status !== 'cancelled') {
    throw new Error('❌ Task status should be "cancelled"');
  }
  console.log(`✓ Task status updated: ${updatedTask.status}`);

  // Test 7: Direct cancelTask call
  const task2 = await adapter.createTask({ ttl: 60000 });
  await adapter.cancelTask(task2.taskId, 'Direct cancel');
  const isCancelled2 = await adapter.isTaskCancelled(task2.taskId);
  if (!isCancelled2) {
    throw new Error('❌ Direct cancelTask should work');
  }
  console.log('✓ Direct cancelTask() call works');

  // Cleanup
  adapter.dispose();

  console.log('\n✅ All task cancellation tests passed!');
  console.log('\nImplementation Summary:');
  console.log('  • updateTaskStatus now detects status === "cancelled"');
  console.log('  • Calls cancelTask() to set cancellation flags');
  console.log('  • isTaskCancelled() returns true after cancellation');
  console.log('  • Cancellation reason is properly stored');
  console.log('  • Task status is updated to "cancelled"');
}

testTaskCancellation().catch(err => {
  console.error('❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
