import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import IndexScreen from '../scanner';

// Mock dependencies
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-router', () => ({
  // Mock any router functions if needed
}));

// Mock Vibration to avoid warnings
jest.mock('react-native/Libraries/Vibration/Vibration', () => ({
  vibrate: jest.fn(),
}));

describe('Scanner Screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('displays the Lot/MAWB correctly in history', async () => {
    const { getByText, getAllByText, getByPlaceholderText, getByRole } = render(<IndexScreen />);

    // 1. Select Lot/MAWB
    fireEvent.press(getByText('กดเพื่อเลือก Lot/MAWB'));
    fireEvent.press(getByText('LOT-2024-001'));

    // 2. Select Customer
    fireEvent.press(getByText('กดเพื่อเลือกลูกค้า'));
    fireEvent.press(getByText('HPC0222'));

    // 3. Select Destination
    fireEvent.press(getByText('กดเพื่อเลือกประเทศปลายทาง'));
    fireEvent.press(getByText('JP - ญี่ปุ่น'));

    // 4. Disable Auto Enter to see the manual submit button
    const autoSwitch = getByRole('switch');
    fireEvent(autoSwitch, 'onValueChange', false);

    // 5. Enter Tracking Number and Submit (Manual)
    const textInput = getByPlaceholderText('กรอกหรือสแกน Tracking No.');
    fireEvent.changeText(textInput, 'TRACK123');

    // Find the submit button (check mark)
    const submitButton = getByText('✓');

    await act(async () => {
        fireEvent.press(submitButton);
        // Advance timers for fakeSubmit (300ms) + unlockTimer (900ms)
        jest.advanceTimersByTime(1500);
    });

    // 6. Check History
    // We expect the correct icon and text to be present
    // The text should be "📦 LOT-2024-001"

    const correctText = await waitFor(() => getAllByText(/📦 LOT-2024-001/));
    expect(correctText.length).toBeGreaterThan(0);
  });
});
