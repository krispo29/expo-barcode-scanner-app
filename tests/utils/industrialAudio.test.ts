import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-av", () => {
  const replayAsync = jest.fn().mockImplementation(() => Promise.resolve({}));
  const playAsync = jest.fn().mockImplementation(() => Promise.resolve({}));
  const stopAsync = jest.fn().mockImplementation(() => Promise.resolve({}));
  const setVolumeAsync = jest.fn().mockImplementation(() => Promise.resolve({}));
  const unloadAsync = jest.fn().mockImplementation(() => Promise.resolve({}));
  const setOnPlaybackStatusUpdate = jest.fn();

  const soundInstance = {
    replayAsync,
    playAsync,
    stopAsync,
    setVolumeAsync,
    unloadAsync,
    setOnPlaybackStatusUpdate,
  };

  const createAsync = jest.fn().mockImplementation(() =>
    Promise.resolve({
      sound: soundInstance,
      status: { isLoaded: true },
    }),
  );

  const setAudioModeAsync = jest.fn().mockImplementation(() => Promise.resolve({}));

  return {
    Audio: {
      Sound: {
        createAsync,
      },
      setAudioModeAsync,
    },
    __mockSoundInstance: soundInstance,
    __mockCreateAsync: createAsync,
    __mockSetAudioModeAsync: setAudioModeAsync,
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { industrialAudio } from "../../utils/industrialAudio";

const {
  __mockSoundInstance: mockSound,
  __mockCreateAsync: mockCreateAsync,
  __mockSetAudioModeAsync: mockSetAudioModeAsync,
} = require("expo-av");

describe("IndustrialSoundManager", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await industrialAudio.unloadAll();
    await industrialAudio.setEnabled(true);
    await industrialAudio.setBoost(false);
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
      const options = (call as any)[1];
      expect(options).toEqual(
        expect.objectContaining({
          shouldPlay: false,
          isLooping: false,
        }),
      );
    }

    // Must NOT attach auto-looping onPlaybackStatusUpdate listener
    expect(mockSound.setOnPlaybackStatusUpdate).not.toHaveBeenCalled();
  });

  test("playSound triggers replayAsync without infinite loop", async () => {
    await industrialAudio.initialize();
    mockSound.replayAsync.mockClear();

    await industrialAudio.playSound("air");
    expect(mockSound.replayAsync).toHaveBeenCalledTimes(1);

    await industrialAudio.playSound("sea");
    expect(mockSound.replayAsync).toHaveBeenCalledTimes(2);

    await industrialAudio.playSound("success");
    expect(mockSound.replayAsync).toHaveBeenCalledTimes(3);

    await industrialAudio.playSound("beep");
    expect(mockSound.replayAsync).toHaveBeenCalledTimes(4);
  });

  test("stopSound stops specific sound and stopAll stops all sounds", async () => {
    await industrialAudio.initialize();
    mockSound.stopAsync.mockClear();

    await industrialAudio.stopSound("air");
    expect(mockSound.stopAsync).toHaveBeenCalledTimes(1);

    await industrialAudio.stopAll();
    // 4 sounds loaded, so stopAll calls stopAsync on all 4
    expect(mockSound.stopAsync).toHaveBeenCalledTimes(5);
  });

  test("playBeepPattern replays beep for the requested count", async () => {
    await industrialAudio.initialize();
    mockSound.replayAsync.mockClear();

    await industrialAudio.playBeepPattern(3, 5);
    expect(mockSound.replayAsync).toHaveBeenCalledTimes(3);
  });

  test("does not play sound when disabled", async () => {
    await industrialAudio.initialize();
    await industrialAudio.setEnabled(false);
    mockSound.replayAsync.mockClear();

    await industrialAudio.playSound("air");
    expect(mockSound.replayAsync).not.toHaveBeenCalled();

    await industrialAudio.playBeepPattern(2, 5);
    expect(mockSound.replayAsync).not.toHaveBeenCalled();
  });

  test("toggles boost and updates volume correctly", async () => {
    await industrialAudio.initialize();
    mockSound.setVolumeAsync.mockClear();

    expect(industrialAudio.isBoosted()).toBe(false);
    expect(industrialAudio.getPlaybackVolume()).toBe(0.75);

    const boosted = await industrialAudio.toggleBoost();
    expect(boosted).toBe(true);
    expect(industrialAudio.isBoosted()).toBe(true);
    expect(industrialAudio.getPlaybackVolume()).toBe(1.0);
    expect(mockSound.setVolumeAsync).toHaveBeenCalledWith(1.0);
  });
});
