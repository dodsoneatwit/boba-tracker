import { useState, useEffect } from "react";

import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
  Dimensions,
  Image as RNImage,
  Platform,
} from 'react-native';

import { Image } from 'expo-image';
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Web-only helpers ──────────────────────────────────────────────────────────

/** Returns a stable anonymous user ID for the current browser. */
function getWebUserId(): string {
  const KEY = 'bobaUserId';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

/** Returns storage keys namespaced to the web user so each browser is unique. */
function webKeys() {
  const uid = getWebUserId();
  return { boba: `${uid}_savedBoba`, images: `${uid}_savedImages` };
}

/** Converts a temporary blob/object URL to a persistent base64 data URL. */
async function blobUriToDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;           // already a data URL
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────────

import ParallaxScrollView from '@/components/parallax-scroll-view';

const SCREEN = Dimensions.get('window');

const COLORS = {
  bg: '#FFF5F7',
  primary: '#D4679C',
  card: '#FFFFFF',
  textDark: '#3D2C35',
  textMid: '#7D6070',
  border: '#F0D6E0',
  inputBg: '#FFF5F7',
  star: '#F9B234',
  starEmpty: '#E0C8D0',
  emptyBg: '#FFF0F5',
};

function StarRating({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onRate(star)} style={starStyles.star}>
          <Text style={{ fontSize: 30, color: star <= rating ? COLORS.star : COLORS.starEmpty }}>
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 16 },
  star: { marginRight: 4 },
});

export default function HomeScreen() {
  const [boba, setBoba] = useState<any[]>([]);
  const [boba_images, setBobaFileImages] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxSize, setLightboxSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!lightboxImage) { setLightboxSize(null); return; }
    const maxW = SCREEN.width * 0.9;
    const maxH = SCREEN.height * 0.7;
    RNImage.getSize(lightboxImage, (w, h) => {
      const scale = Math.min(maxW / w, maxH / h);
      setLightboxSize({ width: w * scale, height: h * scale });
    });
  }, [lightboxImage]);

  const [curr_boba_title, setBobaTitle] = useState("");
  const [curr_boba_description, setBobaDescription] = useState("");
  const [curr_boba_image, setBobaImage] = useState<string | null>(null);
  const [curr_boba_rating, setBobaRating] = useState(0);

  useEffect(() => {
    loadImages();
  }, []);

  const isWeb = Platform.OS === 'web';

  async function loadImages() {
    const keys = isWeb ? webKeys() : { boba: "savedBoba", images: "savedImages" };

    const saved = await AsyncStorage.getItem(keys.images);
    if (saved) setBobaFileImages(JSON.parse(saved));

    const savedBoba = await AsyncStorage.getItem(keys.boba);
    if (savedBoba) setBoba(JSON.parse(savedBoba));
  }

  async function deleteBoba(index: number) {
    const keys = isWeb ? webKeys() : { boba: "savedBoba", images: "savedImages" };

    const updated = boba.filter((_, i) => i !== index);
    setBoba(updated);
    await AsyncStorage.setItem(keys.boba, JSON.stringify(updated));

    const updatedImages = boba_images.filter((_, i) => i !== index);
    setBobaFileImages(updatedImages);
    await AsyncStorage.setItem(keys.images, JSON.stringify(updatedImages));
  }

  async function addMyBoba() {
    if (curr_boba_title !== "" && curr_boba_description !== "" && curr_boba_image && curr_boba_rating !== 0) {
      const keys = isWeb ? webKeys() : { boba: "savedBoba", images: "savedImages" };

      let persistedImageUri: string;

      if (isWeb) {
        // On web: convert the temporary blob/object URL to a data URL so it
        // survives page refreshes. Stored directly in AsyncStorage (localStorage).
        persistedImageUri = await blobUriToDataUrl(curr_boba_image);
      } else {
        // On mobile: copy the picked file into the app's document directory.
        const fileName = Date.now() + ".jpg";
        const newPath = FileSystem.documentDirectory + fileName;
        await FileSystem.copyAsync({ from: curr_boba_image, to: newPath });
        persistedImageUri = newPath;
      }

      const savedBoba = {
        title: curr_boba_title,
        description: curr_boba_description,
        image: persistedImageUri,
        rating: curr_boba_rating,
      };
      const updatedBoba = [...boba, savedBoba];
      setBoba(updatedBoba);
      await AsyncStorage.setItem(keys.boba, JSON.stringify(updatedBoba));

      const updatedImages = [...boba_images, persistedImageUri];
      setBobaFileImages(updatedImages);
      await AsyncStorage.setItem(keys.images, JSON.stringify(updatedImages));

      setBobaTitle("");
      setBobaDescription("");
      setBobaImage(null);
      setBobaRating(0);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setBobaImage(result.assets[0].uri);
    }
  }

  return (
    <>
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#F7C5D8', dark: '#3D2C35' }}
        headerImage={
          <Image
            source={require('@/assets/images/TeaDo_HERO.png')}
            style={styles.heroImage}
          />
        }
      >
        {/* Boba Collection */}
        <Text style={styles.sectionHeading}>My Boba Collection</Text>

        {boba.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🧋</Text>
            <Text style={styles.emptyTitle}>No boba logged yet!</Text>
            <Text style={styles.emptySub}>Add your first one below.</Text>
          </View>
        ) : (
          boba.map((item, index) => (
            <View key={index} style={styles.bobaCard}>
              <TouchableOpacity onPress={() => setLightboxImage(item.image)} activeOpacity={0.85}>
                <View style={styles.bobaCardImageWrap}>
                  <Image
                    source={{ uri: item.image }}
                    style={styles.bobaCardImage}
                    contentFit="contain"
                  />
                </View>
              </TouchableOpacity>
              <View style={styles.bobaCardBody}>
                <Text style={styles.bobaCardTitle}>{item.title}</Text>
                <Text style={styles.bobaCardDesc}>{item.description}</Text>
                <View style={styles.bobaCardFooter}>
                  <View style={{ flexDirection: 'row', marginTop: 6 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Text key={s} style={{ fontSize: 16, color: s <= item.rating ? COLORS.star : COLORS.starEmpty }}>
                        ★
                      </Text>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => deleteBoba(index)} style={styles.deleteButton}>
                    <Text style={styles.deleteButtonText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Add New Boba Form */}
        <Text style={[styles.sectionHeading, { marginTop: 8 }]}>Log a New Boba</Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={curr_boba_title}
            placeholder="e.g. Taro Milk Tea"
            placeholderTextColor={COLORS.textMid}
            onChange={(e) => setBobaTitle(e.nativeEvent.text)}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={curr_boba_description}
            placeholder="Toppings, sweetness level, vibes..."
            placeholderTextColor={COLORS.textMid}
            multiline
            numberOfLines={3}
            onChange={(e) => setBobaDescription(e.nativeEvent.text)}
          />

          <Text style={styles.label}>Photo</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {curr_boba_image ? (
              <Image source={{ uri: curr_boba_image }} style={styles.imagePreview} contentFit="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>📷  Tap to pick a photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Rating</Text>
          <StarRating rating={curr_boba_rating} onRate={setBobaRating} />

          <TouchableOpacity style={styles.addButton} onPress={addMyBoba}>
            <Text style={styles.addButtonText}>+ Add Boba</Text>
          </TouchableOpacity>
        </View>
      </ParallaxScrollView>

      {/* Lightbox */}
      <Modal
        visible={!!lightboxImage}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxImage(null)}
      >
        <Pressable style={styles.lightboxBackdrop} onPress={() => setLightboxImage(null)}>
          <Image
            source={{ uri: lightboxImage ?? '' }}
            style={[styles.lightboxImage, lightboxSize ?? { width: SCREEN.width * 0.9, height: SCREEN.height * 0.7 }]}
            contentFit="cover"
          />
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  heroImage: {
    width: '100%',
    height: '100%',
  },

  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 12,
    letterSpacing: 0.3,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: COLORS.emptyBg,
    borderRadius: 16,
    marginBottom: 8,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMid,
    marginTop: 4,
  },

  // Boba cards
  bobaCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'visible',
  },
  bobaCardImageWrap: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF0F5',
  },
  bobaCardImage: {
    width: '100%',
    height: 260,
  },
  bobaCardBody: {
    padding: 14,
  },
  bobaCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  bobaCardDesc: {
    fontSize: 13,
    color: COLORS.textMid,
  },
  bobaCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteButton: {
    padding: 6,
  },
  deleteButtonText: {
    fontSize: 18,
  },

  // Form
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMid,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 15,
    color: COLORS.textDark,
    backgroundColor: COLORS.inputBg,
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  imagePicker: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  imagePlaceholder: {
    height: 110,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: COLORS.textMid,
  },
  imagePreview: {
    width: '100%',
    height: 160,
  },

  // Submit button
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },

  // Lightbox
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#C49AAE',
  },
});