import { memoryLayout } from '../memory/gbMemoryBus';
import { MemoryBus } from '../memory/memoryBus';

export class Dma {
    private _value = 0;
    private byte = 0;
    private startDelayMCycles = 0;
    private _isTransfering = false;
    public memoryBus: MemoryBus | null = null;

    public startTransfer(start: number) {
        this._isTransfering = true;
        this._value = start;
        this.byte = 0;
        this.startDelayMCycles = 2;
    }

    public get value() {
        return this._value;
    }

    public tick() {
        if (!this._isTransfering) {
            return;
        }

        if (this.startDelayMCycles > 0) {
            --this.startDelayMCycles;
            return;
        }

        // multiply the value with 0x100 to get the address
        if (this.memoryBus) {
            const value = this.memoryBus.read(this._value * 0x100 + this.byte);
            this.memoryBus?.write(memoryLayout.oamStart + this.byte, value);
        }

        ++this.byte;
        this._isTransfering = this.byte <= 0x9f;
    }

    public get isTransfering() {
        return this._isTransfering;
    }
}
