// "Export my data": everything the user owns (export.all) as a JSON file through the share sheet.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { apiCall, Credentials } from '@/api/client';

export function exportFileName(today: string): string {
  return `lift-log-export-${today}.json`;
}

export async function exportMyData(credentials: Credentials, today: string): Promise<void> {
  const data = await apiCall<unknown>('GET', 'export.all', {}, { credentials, timeoutMs: 60_000 });
  const file = new File(Paths.cache, exportFileName(today));
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data, null, 2));
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this phone.");
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export my data', UTI: 'public.json' });
}
