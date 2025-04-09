import { MemoryBus } from '../memory/memoryBus';

export class Cpu {
    private memoryBus: MemoryBus;

    constructor(memoryBus: MemoryBus) {
        this.memoryBus = memoryBus;
    }
}
