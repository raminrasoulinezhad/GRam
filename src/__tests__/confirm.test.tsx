import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import { ConfirmProvider, useConfirm, type ConfirmOptions } from '@/ui/confirm';

/** A button that opens a dialog and records what the user chose. */
function Harness({ options, onResult }: { options: ConfirmOptions; onResult: (ok: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <Pressable testID="open" onPress={() => void confirm(options).then(onResult)}>
      <Text>Open</Text>
    </Pressable>
  );
}

async function renderHarness(options: ConfirmOptions) {
  const onResult = jest.fn();
  await render(
    <ConfirmProvider>
      <Harness options={options} onResult={onResult} />
    </ConfirmProvider>,
  );
  return { onResult };
}

const BASIC: ConfirmOptions = { title: 'Delete plan?', message: 'This cannot be undone.' };

describe('confirmation dialog', () => {
  it('renders nothing until something asks for a decision', async () => {
    await renderHarness(BASIC);

    // Not merely hidden - absent. react-native-web's Modal keeps children in the DOM when
    // visible={false}, which would leave phantom buttons on every screen.
    expect(screen.queryByTestId('confirm-ok')).toBeNull();
    expect(screen.queryByTestId('confirm-cancel')).toBeNull();
    expect(screen.queryByText('Delete plan?')).toBeNull();
  });

  it('shows the title and message when opened', async () => {
    await renderHarness(BASIC);
    await fireEvent.press(screen.getByTestId('open'));

    expect(screen.getByText('Delete plan?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
  });

  it('resolves true when confirmed, and unmounts afterwards', async () => {
    const { onResult } = await renderHarness(BASIC);
    await fireEvent.press(screen.getByTestId('open'));
    await fireEvent.press(screen.getByTestId('confirm-ok'));

    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId('confirm-ok')).toBeNull();
  });

  it('resolves false when cancelled', async () => {
    const { onResult } = await renderHarness(BASIC);
    await fireEvent.press(screen.getByTestId('open'));
    await fireEvent.press(screen.getByTestId('confirm-cancel'));

    expect(onResult).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('confirm-cancel')).toBeNull();
  });

  it('uses the supplied button labels', async () => {
    await renderHarness({ ...BASIC, confirmLabel: 'Discard', cancelLabel: 'Keep going' });
    await fireEvent.press(screen.getByTestId('open'));

    expect(screen.getByText('Discard')).toBeTruthy();
    expect(screen.getByText('Keep going')).toBeTruthy();
  });

  it('defaults the affirmative label to OK', async () => {
    await renderHarness({ title: 'Heads up' });
    await fireEvent.press(screen.getByTestId('open'));

    expect(screen.getByText('OK')).toBeTruthy();
  });

  it('omits the cancel button for a single-button notice', async () => {
    const { onResult } = await renderHarness({ title: 'Empty plan', cancelLabel: null });
    await fireEvent.press(screen.getByTestId('open'));

    expect(screen.queryByTestId('confirm-cancel')).toBeNull();
    await fireEvent.press(screen.getByTestId('confirm-ok'));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('renders without a message', async () => {
    await renderHarness({ title: 'Just a title' });
    await fireEvent.press(screen.getByTestId('open'));

    expect(screen.getByText('Just a title')).toBeTruthy();
  });

  it('refuses to stack a second dialog on top of an open one', async () => {
    const { onResult } = await renderHarness(BASIC);
    await fireEvent.press(screen.getByTestId('open'));
    await fireEvent.press(screen.getByTestId('open'));

    // The second request is declined immediately rather than replacing the live dialog.
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(false);
    expect(screen.getByText('Delete plan?')).toBeTruthy();
  });

  it('can be reopened after being dismissed', async () => {
    const { onResult } = await renderHarness(BASIC);

    await fireEvent.press(screen.getByTestId('open'));
    await fireEvent.press(screen.getByTestId('confirm-cancel'));
    await fireEvent.press(screen.getByTestId('open'));

    expect(screen.getByText('Delete plan?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-ok'));
    expect(onResult).toHaveBeenNthCalledWith(2, true);
  });

  it('throws if used outside the provider, rather than failing silently', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Harness options={BASIC} onResult={jest.fn()} />)).rejects.toThrow(
      /must be used inside a ConfirmProvider/,
    );
    spy.mockRestore();
  });
});
