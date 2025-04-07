import { expect, it } from 'vitest';
import { Ram } from './ram';

it('throws an error when trying to read an invalid address', () => {
    const ram = new Ram(16);
    expect(() => ram.read(16)).toThrow('Invalid address');
    expect(() => ram.read(-1)).toThrow('Invalid address');
});

it('throws an error when trying to write to an invalid address', () => {
    const ram = new Ram(16);
    expect(() => ram.write(16, 42)).toThrow('Invalid address');
    expect(() => ram.write(-1, 42)).toThrow('Invalid address');
});

it('wraps around when writing values greater than 255', () => {
    const ram = new Ram(16);
    ram.write(0, 300); // 300 % 256 = 44
    expect(ram.read(0)).toBe(44);
});

it('wraps around when writing negative values', () => {
    const ram = new Ram(16);
    ram.write(0, -1); // -1 % 256 = 255
    expect(ram.read(0)).toBe(255);
});
