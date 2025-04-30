import { describe, expect, it } from 'vitest';
import { Ppu, PpuMode } from './ppu';
import { Ram } from '../memory/ram';

function setupBasic() {
    const ppu = new Ppu(new Ram(new Uint8Array(0x2000)));
    return ppu;
}

it('does not change the mode after 80 cycles when LCD is disabled', () => {
    const ppu = setupBasic();
    ppu.disableLcd();

    ppu.tick(81);

    expect(ppu.stat.ppuMode).toBe(PpuMode.OamScan);
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

        expect(ppu.stat.ppuMode).toBe(PpuMode.PixelTransfer);
    });
});
