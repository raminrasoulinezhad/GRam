import { render as rtlRender, screen, fireEvent } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ConfirmProvider } from '@/ui/confirm';

/**
 * Renders a screen inside the same providers the real app mounts it in.
 * Every destructive flow goes through ConfirmProvider, so tests need it too.
 */
export function renderScreen(element: ReactElement) {
  return rtlRender(element, { wrapper: ConfirmProvider });
}

/** Presses the affirmative button of the open confirmation dialog. */
export async function confirmDialog() {
  await fireEvent.press(screen.getByTestId('confirm-ok'));
}

/** Dismisses the open confirmation dialog. */
export async function cancelDialog() {
  await fireEvent.press(screen.getByTestId('confirm-cancel'));
}

/** True when a confirmation dialog is currently on screen. */
export function dialogOpen() {
  return screen.queryByTestId('confirm-ok') !== null;
}
