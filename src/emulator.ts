import { Cartridge } from './cartridge';
import { Cpu } from './cpu/cpu';
import { Interrupt, InterruptController } from './interrupts';
import { GbMemoryBus } from './memory/gbMemoryBus';
import { MemoryBus } from './memory/memoryBus';
import { Ram } from './memory/ram';
import { Ppu } from './ppu/ppu';
import { Timer } from './timer';

export class Emulator {
    public readonly timer: Timer;
    public readonly memoryBus: MemoryBus;
    public readonly interruptController: InterruptController;
    public readonly cpu: Cpu;
    public readonly ppu: Ppu;

    constructor() {
        const videoRam = new Ram(new Uint8Array(0x2000));

        this.timer = new Timer();
        this.ppu = new Ppu(videoRam);
        this.memoryBus = new GbMemoryBus(this.timer, this.ppu, videoRam);
        this.interruptController = new InterruptController(this.memoryBus);
        this.cpu = new Cpu(this.memoryBus, this.interruptController);

        this.timer.onTimaOverflow = () =>
            this.interruptController.requestInterrupt(Interrupt.Timer);

        this.ppu.onVBlank = () =>
            this.interruptController.requestInterrupt(Interrupt.VBlank);
    }

    loadRom(data: Uint8Array): void {
        const cartridge = new Cartridge(data);
        this.memoryBus.setRom(cartridge.mbc);

        this.memoryBus.write(0xff05, 0x00);
        this.memoryBus.write(0xff06, 0x00);
        this.memoryBus.write(0xff07, 0x00);
        this.memoryBus.write(0xff10, 0x80);
        this.memoryBus.write(0xff11, 0xbf);
        this.memoryBus.write(0xff12, 0xf3);
        this.memoryBus.write(0xff14, 0xbf);
        this.memoryBus.write(0xff16, 0x3f);
        this.memoryBus.write(0xff17, 0x00);
        this.memoryBus.write(0xff19, 0xbf);
        this.memoryBus.write(0xff1a, 0x7f);
        this.memoryBus.write(0xff1b, 0xff);
        this.memoryBus.write(0xff1c, 0x9f);
        this.memoryBus.write(0xff1e, 0xbf);
        this.memoryBus.write(0xff20, 0xff);
        this.memoryBus.write(0xff21, 0x00);
        this.memoryBus.write(0xff22, 0x00);
        this.memoryBus.write(0xff23, 0xbf);
        this.memoryBus.write(0xff24, 0x77);
        this.memoryBus.write(0xff25, 0xf3);
        this.memoryBus.write(0xff26, 0xf1);
        this.memoryBus.write(0xff40, 0x91);
        this.memoryBus.write(0xff42, 0x00);
        this.memoryBus.write(0xff43, 0x00);
        this.memoryBus.write(0xff45, 0x00);
        this.memoryBus.write(0xff47, 0xfc);
        this.memoryBus.write(0xff48, 0xff);
        this.memoryBus.write(0xff49, 0xff);
        this.memoryBus.write(0xff4a, 0x00);
        this.memoryBus.write(0xff4b, 0x00);
        this.memoryBus.write(0xffff, 0x00);

        this.cpu.reset();
    }

    step(minCyclesToRun: number): void {
        let cyclesExecuted = 0;

        while (cyclesExecuted < minCyclesToRun) {
            const cycles = this.cpu.step();
            this.ppu.tick(cycles);
            this.timer.update(cycles);

            cyclesExecuted += cycles;
        }
    }
}
