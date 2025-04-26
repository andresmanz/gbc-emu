export interface Mbc {
    readByte(addr: number): number;
    writeByte(addr: number, value: number): void;
}
