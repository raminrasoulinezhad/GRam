/**
 * Where the app lives on the web.
 *
 * One constant, because two things need it and they must not drift: the share card on Profile
 * puts it in a QR code, and the feedback box posts to it from a native build where a relative
 * URL has nothing to be relative to.
 *
 * Changing it means re-running `npm run build:qr`, or the QR code goes on pointing at the old
 * address. src/lib/__tests__/qrMatrix.test.ts fails if that step is forgotten.
 */
export const APP_URL = 'https://grambygram.netlify.app';
