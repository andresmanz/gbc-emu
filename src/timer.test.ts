import { describe, expect, it, vi } from 'vitest';
import { Timer, timerCycleThresholds } from './timer';

const timerSettings = [0b00, 0b01, 0b10, 0b11] as const;

/**
 * Updates the timer with a max number of steps at a time.
 * We'd miss the bit transitions if we just called timer.update with a high number of cycles.
 */
function updateTimer(timer: Timer, totalCycles: number, maxCycles = 4) {
    let remaining = totalCycles;

    while (remaining > 0) {
        const cycleAmount = Math.min(maxCycles, remaining);
        timer.update(cycleAmount);
        remaining -= cycleAmount;
    }
}

describe('when calling update', () => {
    it('does not increment DIV after less than 256 cycles', () => {
        const timer = new Timer();

        updateTimer(timer, 255);

        expect(timer.div).toBe(0);
    });

    it('increments DIV every 256 cycles', () => {
        const timer = new Timer();

        updateTimer(timer, 512);

        expect(timer.div).toBe(2);
    });

    it('does not increment TIMA when timer is not enabled', () => {
        const timer = new Timer();
        timer.tac = 0b000;

        updateTimer(timer, timerCycleThresholds[0b00]);

        expect(timer.tima).toBe(0);
    });

    describe('and timer is enabled', () => {
        function setupWithTimerEnabled(clockSelect: number) {
            const timer = new Timer();
            timer.tac = 0b100 | clockSelect;

            return timer;
        }

        describe.for(timerSettings)('and timer is set to %i', timerSetting => {
            it('does not increment TIMA after less than required cycles', () => {
                const timer = setupWithTimerEnabled(timerSetting);

                updateTimer(timer, timerCycleThresholds[timerSetting] - 1);

                expect(timer.tima).toBe(0);
            });

            it('increments TIMA every n cycles', () => {
                const timer = setupWithTimerEnabled(timerSetting);

                updateTimer(timer, timerCycleThresholds[timerSetting] * 2);

                expect(timer.tima).toBe(2);
            });
        });

        it('sets TIMA to TMA when it exceeds 255', () => {
            const timer = setupWithTimerEnabled(0b01);
            timer.tma = 0xfe;

            updateTimer(timer, timerCycleThresholds[0b01] * 256);

            expect(timer.tima).toBe(0xfe);
        });

        it('calls the handler when TIMA overflows', () => {
            const timer = setupWithTimerEnabled(0b01);
            timer.tma = 0xfe;
            const handler = vi.fn();
            timer.onTimaOverflow = handler;

            // since TMA is set to 0xfe, there should be one interrupt after 256 increments and another one after
            // 2 more increments
            updateTimer(timer, timerCycleThresholds[0b01] * 258);

            expect(handler).toBeCalledTimes(2);
        });
    });
});
