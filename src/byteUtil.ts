export function getBit(value: number, bitIndex: number) {
    return (value >> bitIndex) & 1;
}

export function setBit(value: number, bitIndex: number, bitValue: number) {
    return bitValue ? value | (1 << bitIndex) : value & ~(1 << bitIndex);
}
