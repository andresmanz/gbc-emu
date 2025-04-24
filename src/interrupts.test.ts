import { describe, expect, it } from 'vitest';
import { Interrupt, InterruptController } from './interrupts';
import { MockMemoryBus } from './tests/mockMemoryBus';
import { Timer } from './timer';

describe('getNextInterrupt', () => {
    function setupBasic() {
        const timer = new Timer();
        const memoryBus = new MockMemoryBus(0x10000, timer);
        const interruptController = new InterruptController(memoryBus);
        return { interruptController, memoryBus };
    }

    it('returns null when there are no pending interrupts', () => {
        const { interruptController } = setupBasic();

        expect(interruptController.getNextInterrupt()).toBeNull();
    });

    describe('when multiple interrupts are requested', () => {
        function setupWithMultipleInterrupts() {
            const result = setupBasic();

            result.interruptController.requestInterrupt(Interrupt.Serial);
            result.interruptController.requestInterrupt(Interrupt.VBlank);

            return result;
        }

        it('gets them in the correct order', () => {
            const { interruptController } = setupWithMultipleInterrupts();

            const interrupt1 = interruptController.getNextInterrupt();
            expect(interrupt1).toBe(Interrupt.VBlank);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            interruptController.clearInterrupt(interrupt1!);

            const interrupt2 = interruptController.getNextInterrupt();
            expect(interrupt2).toBe(Interrupt.Serial);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            interruptController.clearInterrupt(interrupt2!);

            expect(interruptController.getNextInterrupt()).toBeNull();
        });
    });
});
