import { Rom } from './rom';

export interface MemoryBus {
    setRom(rom: Rom): void;
    read(address: number): number;
    write(address: number, value: number): void;
}
