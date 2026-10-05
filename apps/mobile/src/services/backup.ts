import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { backupSchema, type Project } from '@kpi/shared';
import { useLibrary } from '@/state/library';
import { useProjects } from '@/state/projects';

/**
 * Local backup and restore. There is no server, so this is how users move their projects to a
 * new phone or keep a safety copy: the backup is a JSON file they can save to Files/Drive or send.
 */

export async function exportBackup(): Promise<void> {
  const { projects } = useProjects.getState();
  const { collections, savedIds } = useLibrary.getState();
  const payload = { app: 'kpi-consultant', version: 1, exportedAt: new Date().toISOString(), projects, collections, savedIds };
  const file = new File(Paths.cache, `kpi-consultant-backup-${new Date().toISOString().slice(0, 10)}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save backup' });
}

/** Returns a summary of what was restored, or null if the user cancelled. Throws on invalid files. */
export async function importBackup(): Promise<{ projects: number; collections: number } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(await new File(res.assets[0].uri).text());
  } catch {
    throw new Error('This file is not a valid backup.');
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new Error('This file is not a KPI Consultant backup, or it is damaged.');
  const { projects, collections, savedIds } = parsed.data;
  useProjects.getState().importProjects(projects as Project[]);
  const lib = useLibrary.getState();
  const ids = new Set(collections.map((c) => c.id));
  useLibrary.setState({
    collections: [...collections, ...lib.collections.filter((c) => !ids.has(c.id))],
    savedIds: [...new Set([...lib.savedIds, ...savedIds])],
  });
  return { projects: projects.length, collections: collections.length };
}
