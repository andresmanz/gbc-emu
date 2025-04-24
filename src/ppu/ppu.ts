import { MemoryBus } from '../memory/memoryBus';

export class Ppu {
    private framebuffer = new Uint8ClampedArray(160 * 144 * 4);

    onFrameComplete?: (framebuffer: Uint8ClampedArray) => void;

    constructor(private memoryBus: MemoryBus) {}

    tick(cycles: number) {
        this.framebuffer.fill(0xff);
        this.onFrameComplete?.(this.framebuffer);
    }
}
