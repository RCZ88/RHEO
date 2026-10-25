import { putBlobRecord, getBlobRecord, listBlobRecords, deleteBlobRecord } from '../warmth/localBlobStore';
import type { MemoryGroup } from './types';

const STORE = 'memory-groups';

export async function listGroups(): Promise<MemoryGroup[]> {
  const records = await listBlobRecords<MemoryGroup>(STORE);
  return records.map(r => r.meta).sort((a, b) => a.order - b.order);
}

export async function saveGroup(group: MemoryGroup): Promise<void> {
  await putBlobRecord(STORE, { id: group.id, blob: new Blob([]), meta: group, createdAt: group.createdAt });
}

export async function removeGroup(id: string): Promise<void> {
  await deleteBlobRecord(STORE, id);
}

export async function getGroup(id: string): Promise<MemoryGroup | null> {
  const record = await getBlobRecord<MemoryGroup>(STORE, id);
  return record?.meta ?? null;
}