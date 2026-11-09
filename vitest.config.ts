import { defineConfig } from 'vitest/config';

// Los respaldos y archivos de trabajo no forman parte del código de pruebas.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
