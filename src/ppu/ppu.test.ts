import { describe, expect, it } from 'vitest';
import { MockMemoryBus } from '../tests/mockMemoryBus';
import { Timer } from '../timer';
import { Ppu, PpuMode } from './ppu';

function setupBasic() {
    const timer = new Timer();
    const ppu = new Ppu(new MockMemoryBus(0x10000, timer));
    return ppu;
}

it('does not change the mode after 80 cycles when LCD is disabled', () => {
    const ppu = setupBasic();
    ppu.disableLcd();

    ppu.tick(81);

    expect(ppu.activeMode).toBe(PpuMode.OamScan);
});

describe('when LCD is enabled', () => {
    function setupWithLcdEnabled() {
        const ppu = setupBasic();
        ppu.enableLcd();
        return ppu;
    }

    it('changes to mode to pixel transfer after 80 cycles', () => {
        const ppu = setupWithLcdEnabled();

        ppu.tick(81);

        expect(ppu.activeMode).toBe(PpuMode.PixelTransfer);
    });
});
