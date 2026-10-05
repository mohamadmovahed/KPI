import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

/** Camera / photo library / file input for document & image analysis. */
export const documents = {
  async fromCamera(): Promise<PickedFile | null> {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is needed to photograph a document.');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    return res.canceled ? null : toFile(res.assets[0]);
  },

  async fromLibrary(): Promise<PickedFile | null> {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    return res.canceled ? null : toFile(res.assets[0]);
  },

  async fromFiles(): Promise<PickedFile | null> {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled) return null;
    const a = res.assets[0];
    return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf' };
  },
};

function toFile(a: ImagePicker.ImagePickerAsset): PickedFile {
  const mimeType = a.mimeType ?? 'image/jpeg';
  return { uri: a.uri, name: a.fileName ?? `capture.${mimeType.split('/')[1] ?? 'jpg'}`, mimeType };
}
