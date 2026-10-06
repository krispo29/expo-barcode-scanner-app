import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const mockReplayAsync = jest.fn().mockResolvedValue({});
const mockPlayAsync = jest.fn().mockResolvedValue({});
const mockStopAsync = jest.fn().mockResolvedValue({});
const mockSetVolumeAsync = jest.fn().mockResolvedValue({});
const mockUnloadAsync = jest.fn().mockResolvedValue({});
const mockSetOnPlaybackStatusUpdate = jest.fn();

const mockSoundInstance = {
  replayAsync: mockReplayAsync,
  playAsync: mockPlayAsync,
  stopAsync: mockStopAsync,
  setVolumeAsync: mockSetVolumeAsync,
  unloadAsync: mockUnloadAsync,
  setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
};

const mockCreateAsync = jest.fn().mockResolvedValue({
  sound: mockSoundInstance,
  status: { isLoaded: true },
});

const mockSetAudioModeAsync = jest.fn().mockResolvedValue({});

jest.mock("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: mockCreateAsync,
    },
    setAudioModeAsync: mockSetAudioModeAsync,
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { industrialAudio } from "../../utils/industrialAudio";

describe("IndustrialSoundManager", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await industrialAudio.unloadAll();
  });

  test("initializes audio mode and preloads all sounds with isLooping: false", async () => {
    await industrialAudio.initialize();

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }),
    );

    // Should load air, sea, success, beep
    expect(mockCreateAsync).toHaveBeenCalledTimes(4);

    // Must ensure sounds are NEVER set to loop and do NOT play on creation
    for (const call of mockCreateAsync.mock.calls) {
      const options = call[1];
      expect(options).toEqual(
        expect.objectContaining({
          shouldPlay: false,
          isLooping: false,
        }),
      );
    }

    // Must NOT attach auto-looping onPlaybackStatusUpdate listener
    expect(mockSetOnPlaybackStatusUpdate).not.toHaveBeenCalled();
  });

  test("playSound triggers replayAsync without infinite loop", async () => {
    await industrialAudio.initialize();
    mockReplayAsync.mockClear();

    await industrialAudio.playSound("air");
    expect(mockReplayAsync).toHaveBeenCalledTimes(1);

    await industrialAudio.playSound("sea");
    expect(mockReplayAsync).toHaveBeenCalledTimes(2);

    await industrialAudio.playSound("success");
    expect(mockReplayAsync).toHaveBeenCalledTimes(3);

    await industrialAudio.playSound("beep");
    expect(mockReplayAsync).toHaveBeenCalledTimes(4);
  });

  test("stopSound stops specific sound and stopAll stops all sounds", async () => {
    await industrialAudio.initialize();
    mockStopAsync.mockClear();

    await industrialAudio.stopSound("air");
    expect(mockStopAsync).toHaveBeenCalledTimes(1);

    await industrialAudio.stopAll();
    // 4 sounds loaded, so stopAll calls stopAsync on all 4
    expect(mockStopAsync).toHaveBeenCalledTimes(5);
  });

  test("playBeepPattern replays beep for the requested count", async () => {
    await industrialAudio.initialize();
    mockReplayAsync.mockClear();

    await industrialAudio.playBeepPattern(3, 5);
    expect(mockReplayAsync).toHaveBeenCalledTimes(3);
  });

  test("does not play sound when disabled", async () => {
    await industrialAudio.initialize();
    await industrialAudio.setEnabled(false);
    mockReplayAsync.mockClear();

    await industrialAudio.playSound("air");
    expect(mockReplayAsync).not.toHaveBeenCalled();

    await industrialAudio.playBeepPattern(2, 5);
    expect(mockReplayAsync).not.toHaveBeenCalled();
  });

  test("toggles boost and updates volume correctly", async () => {
    await industrialAudio.initialize();
    mockSetVolumeAsync.mockClear();

    expect(industrialAudio.isBoosted()).toBe(false);
    expect(industrialAudio.getPlaybackVolume()).toBe(0.75);

    const boosted = await industrialAudio.toggleBoost();
    expect(boosted).toBe(true);
    expect(industrialAudio.isBoosted()).toBe(true);
    expect(industrialAudio.getPlaybackVolume()).toBe(1.0);
    expect(mockSetVolumeAsync).toHaveBeenCalledWith(1.0);
  });
});
