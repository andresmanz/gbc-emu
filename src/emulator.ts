import { Cartridge } from './cartridge';
import { Cpu } from './cpu/cpu';
import { Interrupt, InterruptController } from './interrupts';
import {
    DIV_ADDRESS,
    GbMemoryBus,
    IF_REGISTER_ADDRESS,
    LY_ADDRESS,
    TAC_ADDRESS,
    TIMA_ADDRESS,
    TMA_ADDRESS,
} from './memory/gbMemoryBus';
import { Ram } from './memory/ram';
import { Ppu } from './ppu/ppu';
import { Timer } from './timer';
import { Logger } from './logger';

export class Emulator {
    public readonly timer: Timer;
    public readonly memoryBus: GbMemoryBus;
    public readonly interruptController: InterruptController;
    public readonly cpu: Cpu;
    public readonly ppu: Ppu;
    public readonly logger: Logger;

    constructor() {
        this.logger = new Logger();
        const videoRam = new Ram(new Uint8Array(0x2000));

        this.timer = new Timer();
        this.ppu = new Ppu(videoRam);
        this.memoryBus = new GbMemoryBus(this.timer, this.ppu, videoRam);
        this.interruptController = new InterruptController(this.memoryBus);
        this.cpu = new Cpu(
            this.memoryBus,
            this.interruptController,
            this.logger,
        );

        this.timer.onTimaOverflow = () =>
            this.interruptController.requestInterrupt(Interrupt.Timer);

        this.ppu.onVBlank = () =>
            this.interruptController.requestInterrupt(Interrupt.VBlank);
    }

    loadRom(data: Uint8Array): void {
        const cartridge = new Cartridge(data);
        this.memoryBus.setRom(cartridge.mbc);

        this.memoryBus.write(0xff00, 0xcf);
        this.memoryBus.write(0xff01, 0x00);
        this.memoryBus.write(0xff02, 0x7e);
        this.memoryBus.write(DIV_ADDRESS, 0xab);
        this.memoryBus.write(TIMA_ADDRESS, 0x00);
        this.memoryBus.write(TMA_ADDRESS, 0x00);
        this.memoryBus.write(TAC_ADDRESS, 0xf8);
        this.memoryBus.write(IF_REGISTER_ADDRESS, 0xe1);
        this.memoryBus.write(0xff10, 0x80);
        this.memoryBus.write(0xff11, 0xbf);
        this.memoryBus.write(0xff12, 0xf3);
        this.memoryBus.write(0xff13, 0xff);
        this.memoryBus.write(0xff14, 0xbf);
        this.memoryBus.write(0xff16, 0x3f);
        this.memoryBus.write(0xff17, 0x00);
        this.memoryBus.write(0xff18, 0xff);
        this.memoryBus.write(0xff19, 0xbf);
        this.memoryBus.write(0xff1a, 0x7f);
        this.memoryBus.write(0xff1b, 0xff);
        this.memoryBus.write(0xff1c, 0x9f);
        this.memoryBus.write(0xff1d, 0xff);
        this.memoryBus.write(0xff1e, 0xbf);
        this.memoryBus.write(0xff20, 0xff);
        this.memoryBus.write(0xff21, 0x00);
        this.memoryBus.write(0xff22, 0x00);
        this.memoryBus.write(0xff23, 0xbf);
        this.memoryBus.write(0xff24, 0x77);
        this.memoryBus.write(0xff25, 0xf3);
        this.memoryBus.write(0xff26, 0xf1);
        this.memoryBus.write(0xff40, 0x91);
        this.memoryBus.write(0xff41, 0x85);
        this.memoryBus.write(0xff42, 0x00);
        this.memoryBus.write(0xff43, 0x00);
        this.memoryBus.write(LY_ADDRESS, 0x00);
        this.memoryBus.write(0xff45, 0x00);
        this.memoryBus.write(0xff46, 0xff);
        this.memoryBus.write(0xff47, 0xfc);
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
