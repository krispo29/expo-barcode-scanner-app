import { Audio as ExpoAudio } from "expo-av";
import { getSoundSettings, saveSoundSettings } from "./productivityMetrics";

export type SoundKey = "air" | "sea" | "success" | "beep";

export class IndustrialSoundManager {
  private static instance: IndustrialSoundManager;
  private soundObjects: Partial<Record<SoundKey, ExpoAudio.Sound>> = {};
  private soundEnabled: boolean = true;
  private soundBoost: boolean = false;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): IndustrialSoundManager {
    if (!IndustrialSoundManager.instance) {
      IndustrialSoundManager.instance = new IndustrialSoundManager();
    }
    return IndustrialSoundManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 1. Configure audio mode specifically for rugged warehouse devices (e.g. CipherLab RS51)
      await ExpoAudio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false, // Always route through main rear loudspeaker
      });

      // 2. Load stored sound preferences
      const settings = await getSoundSettings();
      this.soundEnabled = settings.enabled;
      this.soundBoost = settings.boost;

      // 3. Preload sound assets
      await this.loadSounds();
      this.initialized = true;
    } catch (err) {
      console.warn("Error initializing IndustrialSoundManager:", err);
    }
  }

  private async loadSounds(): Promise<void> {
    const assets: Record<SoundKey, any> = {
      air: require("../assets/sounds/air.mp3"),
      sea: require("../assets/sounds/sea.mp3"),
      success: require("../assets/sounds/success.mp3"),
      beep: require("../assets/sounds/beep.mp3"),
    };

    const volume = this.getPlaybackVolume();

    for (const [key, asset] of Object.entries(assets)) {
      try {
        const { sound } = await ExpoAudio.Sound.createAsync(
          asset,
          { volume, shouldPlay: false },
        );
        this.soundObjects[key as SoundKey] = sound;
      } catch (err) {
        console.warn(`Failed to load sound asset (${key}):`, err);
      }
    }
  }

  public getPlaybackVolume(): number {
    if (!this.soundEnabled) return 0.0;
    return this.soundBoost ? 1.0 : 0.75;
  }

  public async setEnabled(enabled: boolean): Promise<void> {
    this.soundEnabled = enabled;
    await saveSoundSettings({ enabled, boost: this.soundBoost });
    await this.applyVolume();
  }

  public async setBoost(boost: boolean): Promise<void> {
    this.soundBoost = boost;
    await saveSoundSettings({ enabled: this.soundEnabled, boost });
    await this.applyVolume();
  }

  public async toggleBoost(): Promise<boolean> {
    const next = !this.soundBoost;
    await this.setBoost(next);
    return next;
  }

  public async toggleEnabled(): Promise<boolean> {
    const next = !this.soundEnabled;
    await this.setEnabled(next);
    return next;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public isBoosted(): boolean {
    return this.soundBoost;
  }

  private async applyVolume(): Promise<void> {
    const volume = this.getPlaybackVolume();
    for (const sound of Object.values(this.soundObjects)) {
      if (sound) {
        try {
          await sound.setVolumeAsync(volume);
        } catch {}
      }
    }
  }

  public async playSound(key: SoundKey): Promise<void> {
    if (!this.soundEnabled) return;
    const sound = this.soundObjects[key];
    if (!sound) return;

    try {
      await sound.replayAsync();
    } catch (err) {
      console.warn(`Error playing sound (${key}):`, err);
    }
  }

  public async playBeepPattern(count: number, gapMs: number = 150): Promise<void> {
    if (!this.soundEnabled || count <= 0) return;
    const beepSound = this.soundObjects.beep;
    if (!beepSound) return;

    for (let i = 0; i < count; i += 1) {
      try {
        await beepSound.replayAsync();
      } catch {}
      if (i < count - 1) {
        await new Promise((r) => setTimeout(r, gapMs));
      }
    }
  }

  public async unloadAll(): Promise<void> {
    for (const [key, sound] of Object.entries(this.soundObjects)) {
      try {
        await sound?.unloadAsync();
      } catch {}
    }
    this.soundObjects = {};
    this.initialized = false;
  }
}

export const industrialAudio = IndustrialSoundManager.getInstance();
