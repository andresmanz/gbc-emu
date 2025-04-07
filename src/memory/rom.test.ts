import { expect, it } from 'vitest';
import { Rom } from './rom';

it('throws an error when the size exceeds the length of the bytes', () => {
    const bytes = new Uint8Array(16);
    expect(() => new Rom(20, bytes)).toThrow('Size mismatch');
});

it('throws an error when trying to read an invalid address', () => {
    const rom = new Rom(16, new Uint8Array(16));
    expect(() => rom.read(16)).toThrow('Invalid address');
    expect(() => rom.read(-1)).toThrow('Invalid address');
});
