import { Mbc } from './mbcs/mbc';

export interface MemoryBus {
    setRom(mbc: Mbc): void;
    read(address: number): number;
    write(address: number, value: number): void;
}
