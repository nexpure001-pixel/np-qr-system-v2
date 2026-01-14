import QRCode from 'qrcode';

/**
 * Generates a QR code Data URL from a string.
 * @param text The text to encode (e.g., UUID).
 * @returns Promise<string> A Data URL (data:image/png;base64,...)
 */
export async function generateQrCode(text: string): Promise<string> {
    try {
        return await QRCode.toDataURL(text, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
        });
    } catch (err) {
        console.error('Failed to generate QR code', err);
        throw new Error('QR generation failed');
    }
}
