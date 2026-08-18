import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { APP_URL } from '@/lib/appLink';
import { QR_MODULES } from '@/lib/qrMatrix';
import { ShareCard } from '@/ui/ShareCard';

/**
 * The card that gets the app onto somebody else's phone.
 *
 * The grid itself is checked in src/lib/__tests__/qrMatrix.test.ts. What matters here is the
 * presentation, and specifically the two things that stop a code being scannable no matter how
 * correct the data in it is: the quiet zone and the contrast.
 */

/**
 * react-native-svg rewrites its props before they reach the tree: viewBox becomes four numbers
 * and a colour becomes a packed ARGB integer. These read the rewritten form.
 */
function svg() {
  return screen.getByTestId('share-qr').props as { vbWidth: number; vbHeight: number };
}

const BLACK = 0xff000000;
const WHITE = 0xffffffff;

describe('the share card', () => {
  it('draws the code', async () => {
    await render(<ShareCard />);
    expect(screen.getByTestId('share-qr')).toBeTruthy();
  });

  it('leaves a quiet zone of at least four modules on every side', async () => {
    await render(<ShareCard />);
    // The viewBox is the grid plus the margin. A code drawn flush to its own edge is the
    // classic reason a scanner sees nothing, and it is invisible when you look at the card.
    expect(svg().vbWidth).toBe(QR_MODULES.length + 8);
    expect(svg().vbHeight).toBe(QR_MODULES.length + 8);
  });

  it('draws black on white whatever the theme is', async () => {
    await render(<ShareCard />);
    // Themed colours would look tidier and would not scan on the dark palettes. This is the
    // one surface in the app that ignores the theme, on purpose.
    const json = JSON.stringify(screen.toJSON());
    expect(json).toContain(String(WHITE));
    expect(json).toContain(String(BLACK));
  });

  it('shows the address as text as well, for anyone who cannot scan', async () => {
    await render(<ShareCard />);
    expect(screen.getByText(APP_URL.replace('https://', ''))).toBeTruthy();
  });

  it('opens the app when the address is tapped', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<ShareCard />);
    await fireEvent.press(screen.getByText(APP_URL.replace('https://', '')));
    expect(open).toHaveBeenCalledWith(APP_URL);
    open.mockRestore();
  });

  it('survives a link that will not open', async () => {
    // Nothing to handle a rejection on a phone with no browser registered, and an unhandled
    // one takes the screen down with it.
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    await render(<ShareCard />);
    await fireEvent.press(screen.getByText(APP_URL.replace('https://', '')));
    expect(open).toHaveBeenCalled();
    open.mockRestore();
  });
});
